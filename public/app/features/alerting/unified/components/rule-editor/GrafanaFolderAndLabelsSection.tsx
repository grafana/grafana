import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Field, Input, Label, Modal, Stack, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Trans } from 'app/core/internationalization';
import { createFolder } from 'app/features/manage-dashboards/state/actions';

import { RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { FolderWithoutGroup } from './FolderWithoutGroup';
import { RuleEditorSection } from './RuleEditorSection';
import { containsSlashes, Folder } from './RuleFolderPicker';
import { LabelsEditorModal } from './labels/LabelsEditorModal';
import { LabelsFieldInForm } from './labels/LabelsFieldInForm';

/** Precondition: rule is Grafana managed.
 */
export function GrafanaFolderAndLabelsSection() {
  const { setValue, getValues } = useFormContext<RuleFormValues>();
  const [showLabelsEditor, setShowLabelsEditor] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const resetGroup = useCallback(() => {
    setValue('group', '');
  }, [setValue]);

  const handleFolderCreation = (folder: Folder) => {
    resetGroup();
    setValue('folder', folder);
    setIsCreatingFolder(false);
  };

  function onCloseLabelsEditor(
    labelsToUpdate?: Array<{
      key: string;
      value: string;
    }>
  ) {
    if (labelsToUpdate) {
      setValue('labels', labelsToUpdate);
    }
    setShowLabelsEditor(false);
  }
  return (
    <RuleEditorSection stepNo={3} title="Folder and labels">
      <Stack direction="column" justify-content="flex-start" align-items="flex-start">
        <FolderWithoutGroup />
        <LabelsFieldInForm onEditClick={() => setShowLabelsEditor(true)} />
        <LabelsEditorModal
          isOpen={showLabelsEditor}
          onClose={onCloseLabelsEditor}
          dataSourceName={GRAFANA_RULES_SOURCE_NAME}
          initialLabels={getValues('labels')}
        />
        {isCreatingFolder && (
          <FolderCreationModal onCreate={handleFolderCreation} onClose={() => setIsCreatingFolder(false)} />
        )}
      </Stack>
    </RuleEditorSection>
  );
}

function FolderCreationModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (folder: Folder) => void;
}): React.ReactElement {
  const styles = useStyles2(getStyles);

  const [title, setTitle] = useState('');
  const onSubmit = async () => {
    const newFolder = await createFolder({ title: title });
    if (!newFolder.uid) {
      appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
      return;
    }

    const folder: Folder = { title: newFolder.title, uid: newFolder.uid };
    onCreate(folder);
    appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
  };

  const error = containsSlashes(title);

  return (
    <Modal className={styles.modal} isOpen={true} title={'New folder'} onDismiss={onClose} onClickBackdrop={onClose}>
      <div className={styles.modalTitle}>
        <Trans i18nKey="alerting.rule-form.folder.create-folder">Create a new folder to store your rule</Trans>
      </div>

      <form onSubmit={onSubmit}>
        <Field
          label={
            <Label htmlFor="folder">
              <Trans i18nKey="alerting.rule-form.folder.folder-name">Folder name</Trans>
            </Label>
          }
          error={"The folder name can't contain slashes"}
          invalid={error}
        >
          <Input
            data-testid={selectors.components.AlertRules.newFolderNameField}
            autoFocus={true}
            id="folderName"
            placeholder="Enter a name"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            className={styles.formInput}
          />
        </Field>

        <Modal.ButtonRow>
          <Button variant="secondary" type="button" onClick={onClose}>
            <Trans i18nKey="alerting.rule-form.folder.cancel">Cancel</Trans>
          </Button>
          <Button
            type="submit"
            disabled={!title || error}
            data-testid={selectors.components.AlertRules.newFolderNameCreateButton}
          >
            <Trans i18nKey="alerting.rule-form.folder.create">Create</Trans>
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'baseline',
    maxWidth: `${theme.breakpoints.values.lg}px`,
    justifyContent: 'space-between',
  }),
  formInput: css({
    flexGrow: 1,
  }),
  modal: css({
    width: `${theme.breakpoints.values.sm}px`,
  }),
  modalTitle: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(2),
  }),
});
