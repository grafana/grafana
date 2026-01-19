import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Button,
  Field,
  Input,
  TextArea,
  FileDropzone,
  DropzoneFile,
  FileDropzoneDefaultChildren,
  LinkButton,
  TextLink,
  Label,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';

import { validateDashboardJson, validateGcomDashboard } from '../../utils/validation';

const JSON_PLACEHOLDER = `{
    "title": "Example - Repeating Dictionary variables",
    "uid": "_0HnEoN4z",
    "panels": [...]
    ...
}
`;

type Props = {
  onFileUpload: (result: string | ArrayBuffer | null) => void;
  onGcomSubmit: (formData: { gcomDashboard: string }) => void;
  onJsonSubmit: (formData: { dashboardJson: string }) => void;
};

export function ImportSourceForm({ onFileUpload, onGcomSubmit, onJsonSubmit }: Props) {
  const styles = useStyles2(getStyles);

  // Do not display upload file list
  const fileListRenderer = (_file: DropzoneFile, _removeFile: (file: DropzoneFile) => void) => null;

  const GcomDashboardsLink = () => (
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    <TextLink variant="bodySmall" href="https://grafana.com/grafana/dashboards/" external>
      grafana.com/dashboards
    </TextLink>
  );

  return (
    <>
      <div className={styles.option}>
        <FileDropzone
          options={{ multiple: false, accept: ['.json', '.txt'] }}
          readAs="readAsText"
          fileListRenderer={fileListRenderer}
          onLoad={onFileUpload}
        >
          <FileDropzoneDefaultChildren
            primaryText={t('dashboard-import.file-dropzone.primary-text', 'Upload dashboard JSON file')}
            secondaryText={t('dashboard-import.file-dropzone.secondary-text', 'Drag and drop here or click to browse')}
          />
        </FileDropzone>
      </div>

      <div className={styles.option}>
        <Form onSubmit={onGcomSubmit} defaultValues={{ gcomDashboard: '' }}>
          {({ register, errors }) => (
            <Field
              label={
                <Label className={styles.labelWithLink} htmlFor="url-input">
                  <span>
                    <Trans i18nKey="dashboard-import.gcom-field.label">
                      Find and import dashboards for common applications at <GcomDashboardsLink />
                    </Trans>
                  </span>
                </Label>
              }
              invalid={!!errors.gcomDashboard}
              error={errors.gcomDashboard?.message}
              noMargin
            >
              <Input
                id="url-input"
                placeholder={t('dashboard-import.gcom-field.placeholder', 'Grafana.com dashboard URL or ID')}
                type="text"
                {...register('gcomDashboard', {
                  required: t(
                    'dashboard-import.gcom-field.validation-required',
                    'A Grafana dashboard URL or ID is required'
                  ),
                  validate: validateGcomDashboard,
                })}
                addonAfter={
                  <Button type="submit">
                    <Trans i18nKey="dashboard-import.gcom-field.load-button">Load</Trans>
                  </Button>
                }
              />
            </Field>
          )}
        </Form>
      </div>

      <div className={styles.option}>
        <Form onSubmit={onJsonSubmit} defaultValues={{ dashboardJson: '' }}>
          {({ register, errors }) => (
            <>
              <Field
                label={t('dashboard-import.json-field.label', 'Import via dashboard JSON model')}
                invalid={!!errors.dashboardJson}
                error={errors.dashboardJson?.message}
                noMargin
              >
                <TextArea
                  {...register('dashboardJson', {
                    required: t('dashboard-import.json-field.validation-required', 'Need a dashboard JSON model'),
                    validate: validateDashboardJson,
                  })}
                  data-testid={selectors.components.DashboardImportPage.textarea}
                  id="dashboard-json-textarea"
                  rows={10}
                  placeholder={JSON_PLACEHOLDER}
                />
              </Field>
              <Stack>
                <Button type="submit" data-testid={selectors.components.DashboardImportPage.submit}>
                  <Trans i18nKey="dashboard-import.form-actions.load">Load</Trans>
                </Button>
                <LinkButton variant="secondary" href={`${config.appSubUrl}/dashboards`}>
                  <Trans i18nKey="dashboard-import.form-actions.cancel">Cancel</Trans>
                </LinkButton>
              </Stack>
            </>
          )}
        </Form>
      </div>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    option: css({
      marginBottom: theme.spacing(4),
      maxWidth: '600px',
    }),
    labelWithLink: css({
      maxWidth: '100%',
    }),
  };
}
