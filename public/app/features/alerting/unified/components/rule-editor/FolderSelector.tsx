import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field, Label, Stack } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { t } from 'app/core/internationalization';

import { Trans } from '../../../../../core/internationalization/index';
import { Folder, RuleFormValues } from '../../types/rule-form';
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
    setValue('folder', folder);
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
          data-testid="folder-picker"
        >
          <Stack direction="row" alignItems="center">
            <Controller
              render={({ field: { ref, ...field } }) => (
                <div style={{ width: 420 }}>
                  <NestedFolderPicker
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
                required: { value: true, message: 'Select a folder' },
              }}
            />
            <CreateNewFolder onCreate={handleFolderCreation} />
          </Stack>
        </Field>
      }
    </Stack>
  );
}
