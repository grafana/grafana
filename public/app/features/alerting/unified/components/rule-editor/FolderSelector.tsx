import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Field, Label, Stack } from '@grafana/ui';
import { ProvisioningAwareFolderPicker } from 'app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker';

import { type Folder, type RuleFormValues } from '../../types/rule-form';
import { CreateNewFolder } from '../create-folder/CreateNewFolder';

export function FolderSelector() {
  const {
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<RuleFormValues>();

  const resetGroup = useCallback(() => {
    setValue('group', '');
  }, [setValue]);

  const folder = watch('folder');

  const handleFolderCreation = (folder: Folder) => {
    resetGroup();
    setValue('folder', folder, { shouldValidate: true });
  };

  return (
    <Stack alignItems="center">
      {
        <Field
          label={
            <Label
              htmlFor="folder"
              description={t(
                'alerting.folder-selector.description-select-folder',
                'Select a folder to store your rule in.'
              )}
            >
              <Trans i18nKey="alerting.rule-form.folder.label">Folder</Trans>
            </Label>
          }
          error={errors.folder?.message}
          invalid={!!errors.folder?.message}
          data-testid={selectors.components.AlertRules.folderPicker}
        >
          <Controller
            render={({ field: { ref, ...field } }) => (
              <Stack direction="row" alignItems="center">
                <div style={{ width: 420 }}>
                  <ProvisioningAwareFolderPicker
                    permission="view"
                    showRootFolder={false}
                    repositoryName={undefined}
                    invalid={!!errors.folder?.message}
                    {...field}
                    value={folder?.uid}
                    onChange={(uid, title) => {
                      if (uid && title) {
                        setValue('folder', { title, uid }, { shouldValidate: true });
                      } else {
                        setValue('folder', undefined);
                      }

                      resetGroup();
                    }}
                  />
                </div>
                <CreateNewFolder onCreate={handleFolderCreation} />
              </Stack>
            )}
            name="folder"
            rules={{
              required: {
                value: true,
                message: t('alerting.folder-selector.message.folder-required', 'Folder is required'),
              },
            }}
          />
        </Field>
      }
    </Stack>
  );
}
