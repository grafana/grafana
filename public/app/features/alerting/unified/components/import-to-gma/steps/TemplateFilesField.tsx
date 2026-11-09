import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, FileDropzone, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { type ImportFormValues } from '../types';

import { getClickableDropzoneStyles } from './YamlFileDropzone';

interface TemplateFilesFieldProps {
  /** A file name that was uploaded more than once, if any. */
  duplicateFileName: string | undefined;
}

export function TemplateFilesField({ duplicateFileName }: TemplateFilesFieldProps) {
  const { control } = useFormContext<ImportFormValues>();
  const notifyApp = useAppNotification();
  const clickableDropzone = useStyles2(getClickableDropzoneStyles);

  return (
    <Field
      label={t('alerting.import-to-gma.step1.templates-label', 'Notification templates')}
      description={t(
        'alerting.import-to-gma.step1.templates-desc',
        'Optional. Upload the template files referenced by your Alertmanager config. Each file is imported as a template named after the file.'
      )}
      invalid={Boolean(duplicateFileName)}
      error={
        duplicateFileName
          ? t(
              'alerting.import-to-gma.step1.templates-duplicate',
              'Duplicate template file name: "{{name}}". Template file names must be unique.',
              { name: duplicateFileName }
            )
          : undefined
      }
      noMargin
    >
      <Controller
        render={({ field: { value, onChange } }) => (
          <Stack direction="column" gap={1}>
            <div className={clickableDropzone}>
              <FileDropzone
                // Template files can have any name/extension (mimirtool loads arbitrary *.tpl);
                // the file name becomes the template key, so we don't restrict by extension.
                options={{
                  multiple: true,
                  onDrop: (acceptedFiles) => {
                    onChange([...value, ...acceptedFiles]);
                    const title = t('alerting.import-to-gma.step1.templates-added-title', '', {
                      count: acceptedFiles.length,
                      defaultValue_one: 'Template file added',
                      defaultValue_other: 'Template files added',
                    });
                    notifyApp.success(title, acceptedFiles.map((file) => file.name).join(', '));
                  },
                }}
                fileListRenderer={() => null}
              >
                <Text color="secondary">
                  {t('alerting.import-to-gma.step1.templates-dropzone', 'Drop template files here or click to upload')}
                </Text>
              </FileDropzone>
            </div>

            {value.map((file, index) => (
              <Stack key={`${file.name}-${index}`} direction="row" alignItems="center" justifyContent="space-between">
                <Text>{file.name}</Text>
                <IconButton
                  name="trash-alt"
                  tooltip={t('alerting.import-to-gma.step1.templates-remove', 'Remove {{name}}', {
                    name: file.name,
                  })}
                  onClick={() => onChange(value.filter((_, fileIndex) => fileIndex !== index))}
                />
              </Stack>
            ))}
          </Stack>
        )}
        control={control}
        name="notificationsTemplateFiles"
      />
    </Field>
  );
}
