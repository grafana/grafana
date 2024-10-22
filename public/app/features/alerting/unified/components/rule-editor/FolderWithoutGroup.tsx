import { css } from '@emotion/css';
import * as React from 'react';
import { useCallback, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Field, Input, Label, Modal, Stack, Text, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder } from 'app/features/manage-dashboards/state/actions';
import { AccessControlAction } from 'app/types';

import { Trans } from '../../../../../core/internationalization/index';
import { RuleFormValues } from '../../types/rule-form';

import { containsSlashes, Folder, RuleFolderPicker } from './RuleFolderPicker';

export function FolderWithoutGroup() {
  const {
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const resetGroup = useCallback(() => {
    setValue('group', '');
  }, [setValue]);
  const styles = useStyles2(getStyles);

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const onOpenFolderCreationModal = () => setIsCreatingFolder(true);

  const handleFolderCreation = (folder: Folder) => {
    resetGroup();
    setValue('folder', folder);
    setIsCreatingFolder(false);
  };

  return (
    <div className={styles.container}>
      <Stack alignItems="center">
        {
          <Field
            label={
              <Label htmlFor="folder" description={'Select a folder to store your rule.'}>
                <Trans i18nKey="alerting.rule-form.folder.label">Folder</Trans>
              </Label>
            }
            className={styles.formInput}
            error={errors.folder?.message}
            data-testid="folder-picker"
          >
            <Stack direction="row" alignItems="center">
              {(!isCreatingFolder && (
                <>
                  <Controller
                    render={({ field: { ref, ...field } }) => (
                      <div style={{ width: 420 }}>
                        <RuleFolderPicker
                          inputId="folder"
                          invalid={!!errors.folder?.message}
                          {...field}
                          enableReset={true}
                          onChange={({ title, uid }) => {
                            field.onChange({ title, uid });
                            resetGroup();
                          }}
                        />
                      </div>
                    )}
                    name="folder"
                    rules={{
                      required: { value: true, message: 'Select a folder' },
                    }}
                  />
                  <Text color="secondary">
                    <Trans i18nKey="alerting.rule-form.folder.new-folder-or">or</Trans>
                  </Text>
                  <Button
                    onClick={onOpenFolderCreationModal}
                    type="button"
                    icon="plus"
                    fill="outline"
                    variant="secondary"
                    disabled={!contextSrv.hasPermission(AccessControlAction.FoldersCreate)}
                    data-testid={selectors.components.AlertRules.newFolderButton}
                  >
                    <Trans i18nKey="alerting.rule-form.folder.new-folder">New folder</Trans>
                  </Button>
                </>
              )) || (
                <div>
                  <Trans i18nKey="alerting.rule-form.folder.creating-new-folder">Creating new folder...</Trans>
                </div>
              )}
            </Stack>
          </Field>
        }
        {isCreatingFolder && (
          <FolderCreationModal onCreate={handleFolderCreation} onClose={() => setIsCreatingFolder(false)} />
        )}
      </Stack>

      {isCreatingFolder && (
        <FolderCreationModal onCreate={handleFolderCreation} onClose={() => setIsCreatingFolder(false)} />
      )}
    </div>
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
