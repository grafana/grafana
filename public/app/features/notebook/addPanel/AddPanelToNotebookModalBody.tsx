import { useRef, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import {
  Box,
  Button,
  Checkbox,
  Combobox,
  FilterInput,
  Modal,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  TextLink,
} from '@grafana/ui';
import { createSuccessNotification, createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types/accessControl';

import { type PanelElement } from '../types';
import { notebookViewHref } from '../urls';

import { CreateNotebookForm, type CreateNotebookFormValues } from './CreateNotebookForm';
import { NotebookPickerList } from './NotebookPickerList';
import {
  addPanelErrorMessage,
  addPanelToExistingNotebook,
  type AddedToNotebook,
  createNotebookWithPanel,
} from './addPanelToNotebook';
import { getSortOptions, useNotebookPicker } from './useNotebookPicker';

const CREATE_FORM_ID = 'add-panel-create-notebook';

type PickerTab = 'existing' | 'new';

interface Props {
  /**
   * Called on submit rather than on open: on a dashboard the panel can still be edited while the
   * modal is up, and serializing every opened modal would be work nobody asked for.
   */
  buildPanel: () => Promise<PanelElement>;
  onDismiss: () => void;
}

export function AddPanelToNotebookModalBody({ buildPanel, onDismiss }: Props) {
  const canAddToExisting = contextSrv.hasPermission(AccessControlAction.DashboardsWrite);
  const canCreate = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);

  const [tab, setTab] = useState<PickerTab>(canAddToExisting ? 'existing' : 'new');
  const [selectedUid, setSelectedUid] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guards the write, where isSubmitting only guards the button: state takes effect on the next
  // render, so a second activation arriving before that would start its own read-modify-write and
  // append the panel twice. A ref closes that window because it updates synchronously.
  const isSubmittingRef = useRef(false);

  const picker = useNotebookPicker();

  // A selection the filters have since hidden is derived away rather than cleared in an effect: the
  // uid is still in state, so relaxing the filter brings the choice back instead of silently
  // dropping it. What must not happen is submitting to a notebook the user can no longer see.
  const selected = picker.rows.some((row) => row.uid === selectedUid) ? selectedUid : undefined;

  const submit = async (add: () => Promise<AddedToNotebook>) => {
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const added = await add();
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
      setIsSubmitting(false);
    }
  };

  const onCreate = (values: CreateNotebookFormValues) =>
    submit(() =>
      buildPanel().then((panel) =>
        createNotebookWithPanel(
          { title: values.title.trim(), description: values.description.trim(), tags: values.tags },
          panel
        )
      )
    );

  return (
    <>
      <TabsBar>
        {canAddToExisting && (
          <Tab
            label={t('notebooks.add-panel.tab-existing', 'Add to existing')}
            active={tab === 'existing'}
            onChangeTab={() => setTab('existing')}
          />
        )}
        {canCreate && (
          <Tab
            label={t('notebooks.add-panel.tab-new', 'Create new')}
            active={tab === 'new'}
            onChangeTab={() => setTab('new')}
          />
        )}
      </TabsBar>

      {/* TabContent is a bare div with no padding of its own, so the gap under the tab bar's border
          has to come from here. */}
      <TabContent>
        <Box paddingTop={3}>
          {tab === 'existing' ? (
            <Stack direction="column" gap={2}>
              <Stack gap={1} alignItems="flex-start">
                <FilterInput
                  value={picker.searchQuery}
                  onChange={picker.setSearchQuery}
                  placeholder={t('notebooks.add-panel.search-placeholder', 'Search by title')}
                  autoFocus
                />
                <Combobox
                  value={picker.sort}
                  options={getSortOptions()}
                  onChange={(option) => picker.setSort(option.value)}
                  width={22}
                  aria-label={t('notebooks.add-panel.sort-label', 'Sort notebooks')}
                />
              </Stack>

              {/* Not a picker of authors: filtering by one is supported server-side, but listing
                  them is not - createdBy is filterable and not facetable - and enumerating them from
                  the rows on screen would offer only the authors already visible. */}
              {picker.canFilterByMe && (
                <Checkbox
                  value={picker.createdByMe}
                  onChange={(event) => picker.setCreatedByMe(event.currentTarget.checked)}
                  label={t('notebooks.add-panel.created-by-me', 'Created by me')}
                />
              )}

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
            <CreateNotebookForm formId={CREATE_FORM_ID} onSubmit={onCreate} disabled={isSubmitting} />
          )}
        </Box>
      </TabContent>

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="notebooks.add-panel.cancel">Cancel</Trans>
        </Button>
        {tab === 'existing' ? (
          <Button
            onClick={() =>
              selected && submit(() => buildPanel().then((panel) => addPanelToExistingNotebook(selected, panel)))
            }
            disabled={!selected || isSubmitting}
          >
            <Trans i18nKey="notebooks.add-panel.submit">Add to notebook</Trans>
          </Button>
        ) : (
          // Submits the form by id, so the footer stays shared without lifting the form state up here.
          <Button type="submit" form={CREATE_FORM_ID} disabled={isSubmitting}>
            <Trans i18nKey="notebooks.add-panel.submit">Add to notebook</Trans>
          </Button>
        )}
      </Modal.ButtonRow>
    </>
  );
}
