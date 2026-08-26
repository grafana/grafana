import { css } from '@emotion/css';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Box,
  Button,
  Checkbox,
  Combobox,
  Field,
  FilterInput,
  Modal,
  MultiCombobox,
  RadioButtonGroup,
  Stack,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { createSuccessNotification, createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { dispatch } from 'app/store/store';

import { canCreateNotebooks, canEditNotebooks } from '../permissions';
import { useNotebookTagOptions } from '../scene/layout-notebook/useNotebookTagOptions';
import { type PanelElement } from '../types';
import { notebookViewHref } from '../urls';

import { CreateNotebookFields } from './CreateNotebookFields';
import { NotebookPickerList } from './NotebookPickerList';
import { type AddPanelFormValues } from './addPanelForm';
import { addPanelErrorMessage, addPanelToExistingNotebook, createNotebookWithPanel } from './addPanelToNotebook';
import { getSortOptions, useNotebookPicker } from './useNotebookPicker';

const FORM_ID = 'add-panel-to-notebook';
const TAG_FILTER_LABEL_ID = 'add-panel-tag-filter-label';

interface Props {
  /**
   * Called on submit rather than on open: on a dashboard the panel can still be edited while the
   * modal is up, and serializing every opened modal would be work nobody asked for.
   */
  buildPanel: () => Promise<PanelElement>;
  onDismiss: () => void;
}

export function AddPanelToNotebookModalBody({ buildPanel, onDismiss }: Props) {
  const styles = useStyles2(getStyles);
  const canAddToExisting = canEditNotebooks();
  const canCreate = canCreateNotebooks();

  // New first, and first is the default — the same order and default as the add-to-dashboard modal,
  // where leading with "new" is what keeps creating one from feeling like the secondary path.
  const saveTargets = [
    ...(canCreate ? [{ value: 'new' as const, label: t('notebooks.add-panel.target-new', 'New notebook') }] : []),
    ...(canAddToExisting
      ? [{ value: 'existing' as const, label: t('notebooks.add-panel.target-existing', 'Existing notebook') }]
      : []),
  ];

  const {
    control,
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm<AddPanelFormValues>({
    defaultValues: { saveTarget: saveTargets[0]?.value, title: '', description: '', tags: [] },
  });

  // With only one route open to this user there is nothing to choose, so the control is not rendered
  // and the single permitted target stands in for what it would have said.
  const saveTarget = saveTargets.length > 1 ? watch('saveTarget') : saveTargets[0]?.value;

  const picker = useNotebookPicker();
  // Every tag in the library, not only the ones the current results carry: this is what narrows the
  // results, so offering only co-occurring tags would let the filter talk itself into a corner. The
  // selected ones are unioned in so a tag cannot vanish from the list while it is doing the filtering.
  const tagOptions = useNotebookTagOptions(picker.tagFilter);
  const [selectedUid, setSelectedUid] = useState<string>();

  // A selection the filters have since hidden is derived away rather than cleared in an effect: the
  // uid is still in state, so relaxing the filter brings the choice back instead of silently
  // dropping it. What must not happen is submitting to a notebook the user can no longer see.
  const selected = picker.rows.some((row) => row.uid === selectedUid) ? selectedUid : undefined;

  // Guards the write, where the loading flag only guards the button: both `useAsyncFn`'s state and
  // react-hook-form's own take effect on the next render, so a second activation arriving before that
  // would start its own read-modify-write and append the panel twice. A ref closes that window
  // because it updates synchronously.
  const isSubmittingRef = useRef(false);

  const [submitState, onSubmit] = useAsyncFn(
    async (values: AddPanelFormValues) => {
      if (isSubmittingRef.current) {
        return;
      }

      // Refused rather than left to fall through to creating one. The submit button is already
      // disabled without a selection, so nothing reaches this today - but "create" must not be what
      // happens for every state that is not a valid existing selection, or loosening that button's
      // disabled rule later silently turns into a notebook with no title.
      const existingUid = values.saveTarget === 'existing' ? selected : undefined;
      if (values.saveTarget === 'existing' && !existingUid) {
        return;
      }

      isSubmittingRef.current = true;

      try {
        const panel = await buildPanel();
        const added = existingUid
          ? await addPanelToExistingNotebook(existingUid, panel)
          : await createNotebookWithPanel(
              { title: values.title.trim(), description: values.description.trim(), tags: values.tags },
              panel
            );

        dispatch(
          notifyApp(
            createSuccessNotification(
              t('notebooks.add-panel.success', 'Panel added to {{title}}', { title: added.title }),
              '',
              undefined,
              <TextLink href={notebookViewHref(added.uid)}>
                <Trans i18nKey="notebooks.add-panel.success-link">View notebook</Trans>
              </TextLink>
            )
          )
        );
        onDismiss();
      } catch (error) {
        dispatch(notifyApp(createErrorNotification(addPanelErrorMessage(error))));
        // Deliberately left open: a conflict is worth retrying, and retyping a new notebook's details
        // because the request failed would be its own small insult.
        isSubmittingRef.current = false;
        throw error;
      }
    },
    [buildPanel, onDismiss, selected]
  );

  const isSubmitting = submitState.loading;

  // The duplicate-title check reads `picker.rows`, which is empty until the first page lands and keeps
  // filling after it, so submitting before then would accept a name that is already taken. Only the
  // create route uses those titles. It stays best-effort either way — the rows carry whatever filters
  // are set, and stop at the accumulation ceiling — but a name it does find really is taken, so this
  // only ever removes false negatives.
  const isCheckingTitles = saveTarget === 'new' && (picker.isLoading || picker.isReloading || picker.isLoadingMore);

  return (
    <>
      {/* Padded at the bottom as well as the top: Modal's content area scrolls and has no bottom
          padding of its own, so the last field would otherwise be shaved by the scrollport edge. */}
      <Box paddingTop={1} paddingBottom={1}>
        <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)}>
          <Stack direction="column" gap={2}>
            {saveTargets.length > 1 && (
              <Controller
                control={control}
                name="saveTarget"
                render={({ field: { ref, ...field } }) => (
                  <Field
                    noMargin
                    label={t('notebooks.add-panel.target-label', 'Target notebook')}
                    description={t('notebooks.add-panel.target-description', 'Choose where to add the panel.')}
                  >
                    <RadioButtonGroup options={saveTargets} {...field} id="add-panel-target" />
                  </Field>
                )}
              />
            )}

            {saveTarget === 'existing' ? (
              <Stack direction="column" gap={2}>
                {/* Two rows rather than one: finding a notebook is what the search box does, and the
                    tag and author filters narrow what it found. Four controls abreast also leaves the
                    search box too short to read a title in. */}
                <Stack direction="column" gap={1}>
                  <Stack gap={1} alignItems="center">
                    {/* Takes the rest of the line so the row reads as one group rather than a short
                        box with a control trailing it. */}
                    <Box grow={1}>
                      <FilterInput
                        value={picker.searchQuery}
                        onChange={picker.setSearchQuery}
                        placeholder={t('notebooks.add-panel.search-placeholder', 'Search by title')}
                        autoFocus
                      />
                    </Box>
                    <Combobox
                      value={picker.sort}
                      options={getSortOptions()}
                      onChange={(option) => picker.setSort(option.value)}
                      width={22}
                      aria-label={t('notebooks.add-panel.sort-label', 'Sort notebooks')}
                    />
                  </Stack>

                  <Stack gap={1} alignItems="center">
                    {/* MultiCombobox forwards aria-labelledby but not aria-label, so it is labelled
                        by a hidden element - the same workaround the provisioning resource tree
                        uses. The sort control above is a single Combobox, which does forward
                        aria-label. */}
                    <span id={TAG_FILTER_LABEL_ID} className="sr-only">
                      {t('notebooks.add-panel.tag-label', 'Filter by tag')}
                    </span>
                    <MultiCombobox
                      aria-labelledby={TAG_FILTER_LABEL_ID}
                      options={tagOptions}
                      value={picker.tagFilter}
                      onChange={(selected) => picker.setTagFilter(selected.map((option) => option.value))}
                      placeholder={t('notebooks.add-panel.tag-placeholder', 'Filter by tag')}
                      width={30}
                    />
                    {/* Not a picker of authors: filtering by one is supported server-side, but
                        listing them is not - createdBy is filterable and not facetable - and
                        enumerating them from the rows on screen would offer only the authors
                        already visible. */}
                    {picker.canFilterByMe && (
                      <div className={styles.filterToggle}>
                        <Checkbox
                          value={picker.createdByMe}
                          onChange={(event) => picker.setCreatedByMe(event.currentTarget.checked)}
                          label={t('notebooks.add-panel.created-by-me', 'Created by me')}
                        />
                      </div>
                    )}
                  </Stack>
                </Stack>

                <NotebookPickerList
                  notebooks={picker.rows}
                  isFiltered={picker.isFiltered}
                  canCreate={canCreate}
                  isLoading={picker.isLoading}
                  isReloading={picker.isReloading}
                  error={picker.error}
                  isTruncated={picker.isTruncated}
                  selectedUid={selected}
                  onSelect={setSelectedUid}
                />
              </Stack>
            ) : (
              <CreateNotebookFields
                control={control}
                register={register}
                errors={errors}
                existingTitles={picker.rows.map((row) => row.title)}
                disabled={isSubmitting}
              />
            )}
          </Stack>
        </form>
      </Box>

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="notebooks.add-panel.cancel">Cancel</Trans>
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          disabled={isSubmitting || isCheckingTitles || (saveTarget === 'existing' && !selected)}
          icon={isSubmitting ? 'spinner' : undefined}
        >
          <Trans i18nKey="notebooks.add-panel.submit">Add to notebook</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Checkbox sizes itself to its label's line box, which is shorter than the inputs beside it, so
  // centring the row alone still leaves it sitting high. Giving it the same height as those controls
  // puts it on their centre line. Wrapped rather than styled through Checkbox itself, which would
  // mean reaching into a grafana-ui component's own layout.
  filterToggle: css({
    display: 'flex',
    alignItems: 'center',
    minHeight: theme.spacing(theme.components.height.md),
  }),
});
