import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Field, Icon, Label, Stack, Tooltip } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';

import { Folder, RuleFormValues } from '../../types/rule-form';
import { CreateNewFolder } from '../create-folder/CreateNewFolder';

export function FolderSelectorV2() {
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
    setValue('folder', folder);
  };

  return (
    <Stack alignItems="center">
      {
        <Field
          noMargin
          label={
            <Label
              htmlFor="folder"
              description={t(
                'alerting.folder-selector.description-select-folder',
                'Select a folder to store your rule in.'
              )}
            >
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Trans i18nKey="alerting.rule-form.folder.label">Folder</Trans>
                <Tooltip
                  content={t(
                    'alerting.rule-form.folders.help-info',
                    'Folders are used for storing alert rules. You can extend the access provided by a role to alert rules and assign permissions to individual folders.'
                  )}
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            </Label>
          }
          error={errors.folder?.message}
          data-testid="folder-picker"
        >
          <Stack direction="column" alignItems="flex-start" gap={0.5}>
            <Controller
              render={({ field: { ref, ...field } }) => (
                <div style={{ width: 420 }}>
                  <NestedFolderPicker
                    permission="view"
                    showRootFolder={false}
                    invalid={!!errors.folder?.message}
                    {...field}
                    value={folder?.uid}
                    onChange={(uid, title) => {
                      if (uid && title) {
                        setValue('folder', { title, uid });
                      } else {
                        setValue('folder', undefined);
                      }

                      resetGroup();
                    }}
                  />
                </div>
              )}
              name="folder"
              rules={{
                required: {
                  value: true,
                  message: t('alerting.folder-selector.message.select-a-folder', 'Select a folder'),
                },
              }}
            />
            <CreateNewFolder onCreate={handleFolderCreation} />
          </Stack>
        </Field>
      }
    </Stack>
  );
}
