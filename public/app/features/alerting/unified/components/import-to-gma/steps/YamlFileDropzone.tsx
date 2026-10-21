import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, formattedValueToString, getValueFormat } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, FileDropzone, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

export const YAML_FILE_EXTENSIONS = ['.yaml', '.yml'];

/**
 * FileDropzone only opens the file picker from the area around its text, not from the padding of the
 * dashed box it draws, so clicks near the edges do nothing. This stretches that area over the padding,
 * so the whole box can be clicked. Put it on an element wrapping the FileDropzone.
 */
export const getClickableDropzoneStyles = (theme: GrafanaTheme2) =>
  css({
    '[data-testid="dropzone"]': {
      alignSelf: 'stretch',
      width: 'auto',
      margin: theme.spacing(-2),
      padding: theme.spacing(2),
    },
  });

// FileDropzone has no prop to suppress its built-in "Accepted file types" caption, shown via Field description instead.
const hideAcceptedFileTypesCaption = css({
  small: {
    display: 'none',
  },
});

// FileDropzone's `accept` option buckets extensions by MIME type, so a `.txt` file (MIME
// text/plain) collides with the `.yml` bucket and passes; re-check the filename directly.
function validateYamlFileExtension(file: File) {
  const hasYamlExtension = YAML_FILE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  if (hasYamlExtension) {
    return null;
  }
  return {
    code: 'file-invalid-type',
    message: t('alerting.import-to-gma.yaml-file.invalid-type', 'File must be a YAML file ({{extensions}})', {
      extensions: YAML_FILE_EXTENSIONS.join(', '),
    }),
  };
}

/** The "Accepted file types" text to show as the Field description, since the dropzone's own is hidden. */
export function getYamlFileDescription() {
  return t('alerting.import-to-gma.yaml-file.description', 'Accepted file types: {{extensions}}', {
    extensions: YAML_FILE_EXTENSIONS.join(', '),
  });
}

interface YamlFileDropzoneProps {
  file: File | null | undefined;
  onChange: (file: File | null) => void;
  /** Called after a file is accepted, for example to confirm the upload. */
  onUploaded?: (file: File) => void;
}

/**
 * Drop zone for a single YAML file. Once a file is chosen it replaces the drop zone, since only one file
 * can be imported; removing it brings the drop zone back.
 * Wrap it in a Field that uses getYamlFileDescription() as its description.
 */
export function YamlFileDropzone({ file, onChange, onUploaded }: YamlFileDropzoneProps) {
  const clickableDropzone = useStyles2(getClickableDropzoneStyles);

  if (file) {
    return <SelectedYamlFile file={file} onRemove={() => onChange(null)} />;
  }

  return (
    <div className={cx(hideAcceptedFileTypesCaption, clickableDropzone)}>
      <FileDropzone
        options={{
          multiple: false,
          accept: YAML_FILE_EXTENSIONS,
          validator: validateYamlFileExtension,
          onDrop: (acceptedFiles) => {
            const accepted = acceptedFiles[0];
            if (accepted) {
              onChange(accepted);
              onUploaded?.(accepted);
            }
          },
        }}
        fileListRenderer={() => null}
      >
        <Text color="secondary">
          {t('alerting.import-to-gma.yaml-file.upload', 'Drop YAML file here or click to upload')}
        </Text>
      </FileDropzone>
    </div>
  );
}

function SelectedYamlFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const styles = useStyles2(getStyles);
  const size = formattedValueToString(getValueFormat('decbytes')(file.size));

  return (
    <div className={styles.selectedFile}>
      <Stack direction="row" alignItems="center" gap={1.5} minWidth={0}>
        <Icon name="file-alt" size="xl" className={styles.fileIcon} />
        <Stack direction="column" gap={0} minWidth={0}>
          <Text weight="medium" truncate>
            {file.name}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {size}
          </Text>
        </Stack>
      </Stack>
      <Button
        variant="secondary"
        fill="outline"
        size="sm"
        icon="trash-alt"
        onClick={onRemove}
        aria-label={t('alerting.import-to-gma.yaml-file.remove', 'Remove {{name}}', { name: file.name })}
      >
        <Trans i18nKey="alerting.import-to-gma.yaml-file.remove-button">Remove</Trans>
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  selectedFile: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
  }),
  fileIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
});
