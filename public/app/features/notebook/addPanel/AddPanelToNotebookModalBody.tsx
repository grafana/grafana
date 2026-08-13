import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import {
  Button,
  Combobox,
  FilterInput,
  Modal,
  MultiCombobox,
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
import { addPanelErrorMessage, type AddedToNotebook, useAddPanelToNotebook } from './useAddPanelToNotebook';
import { getSortOptions, useNotebookPicker } from './useNotebookPicker';

const CREATE_FORM_ID = 'add-panel-create-notebook';

type PickerTab = 'existing' | 'new';

interface Props {
  /**
   * Called on submit rather than on open: on a dashboard the panel can still be edited while the
   * modal is up, and serializing every opened modal would be work nobody asked for.
   */
  buildPanel: () => PanelElement;
  onDismiss: () => void;
}

export function AddPanelToNotebookModalBody({ buildPanel, onDismiss }: Props) {
  const canAddToExisting = contextSrv.hasPermission(AccessControlAction.DashboardsWrite);
  const canCreate = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);

  const [tab, setTab] = useState<PickerTab>(canAddToExisting ? 'existing' : 'new');
  const [selectedUid, setSelectedUid] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const picker = useNotebookPicker();
  const { addToExisting, createWithPanel } = useAddPanelToNotebook();

  const submit = async (add: () => Promise<AddedToNotebook>) => {
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
      setIsSubmitting(false);
    }
  };

  const onCreate = (values: CreateNotebookFormValues) =>
    submit(() =>
      createWithPanel(
        { title: values.title.trim(), description: values.description.trim(), tags: values.tags },
        buildPanel()
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

      <TabContent>
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

            <Stack gap={1}>
              <MultiCombobox
                value={picker.tagFilter}
                options={picker.tagOptions}
                onChange={(options) => picker.setTagFilter(options.map((option) => option.value))}
                placeholder={t('notebooks.add-panel.tag-placeholder', 'Filter by tag')}
                width={30}
                aria-label={t('notebooks.add-panel.tag-placeholder', 'Filter by tag')}
              />
              <Combobox
                value={picker.authorFilter}
                options={picker.authorOptions}
                onChange={(option) => picker.setAuthorFilter(option?.value ?? '')}
                placeholder={t('notebooks.add-panel.author-placeholder', 'All authors')}
                width={30}
                isClearable
                aria-label={t('notebooks.add-panel.author-label', 'Filter by author')}
              />
            </Stack>

            <NotebookPickerList
              notebooks={picker.rows}
              totalCount={picker.totalCount}
              isLoading={picker.isLoading}
              error={picker.error}
              isTruncated={picker.isTruncated}
              selectedUid={selectedUid}
              onSelect={setSelectedUid}
            />
          </Stack>
        ) : (
          <CreateNotebookForm formId={CREATE_FORM_ID} onSubmit={onCreate} disabled={isSubmitting} />
        )}
      </TabContent>

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="notebooks.add-panel.cancel">Cancel</Trans>
        </Button>
        {tab === 'existing' ? (
          <Button
            onClick={() => selectedUid && submit(() => addToExisting(selectedUid, buildPanel()))}
            disabled={!selectedUid || isSubmitting}
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
