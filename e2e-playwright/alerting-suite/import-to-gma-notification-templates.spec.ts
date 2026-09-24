import { test, expect } from '@grafana/plugin-e2e';

import { DROPZONE_TEST_ID, dragFilesOntoDropzone, dropzoneInput, writeFilesForDrag } from '../utils/dropzone-helpers';

const SLACK_TEMPLATE = '{{ define "slack.title" }}{{ .Status }} alert{{ end }}';
const EMAIL_TEMPLATE = '{{ define "email.subject" }}{{ .CommonLabels.alertname }}{{ end }}';

test.use({
  featureToggles: {
    alertingMigrationWizardUI: true,
  },
});

/**
 * Step 1 of the import wizard uploads the notification templates that the imported Alertmanager
 * config references. Every file added here becomes a template keyed by its file name, so the file
 * list and its duplicate-name validation are the only guard against a silently dropped template.
 */
test.describe(
  'Import to Grafana-managed alerting — notification templates',
  {
    tag: ['@alerting'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/alerting/import-to-gma');
      // The YAML source is selected by default and is what renders the template dropzone.
      await expect(page.getByRole('radio', { name: /YAML file/ })).toBeChecked();
      await expect(page.getByTestId(DROPZONE_TEST_ID)).toBeVisible();
    });

    test('lists every template file added through the file picker', async ({ page }) => {
      await dropzoneInput(page).setInputFiles([
        { name: 'slack.tmpl', mimeType: 'text/plain', buffer: Buffer.from(SLACK_TEMPLATE) },
        { name: 'email.tmpl', mimeType: 'text/plain', buffer: Buffer.from(EMAIL_TEMPLATE) },
      ]);

      await expect(page.getByText('slack.tmpl', { exact: true })).toBeVisible();
      await expect(page.getByText('email.tmpl', { exact: true })).toBeVisible();
    });

    test('lists template files dragged onto the dropzone', async ({ page }, testInfo) => {
      const filePaths = writeFilesForDrag(testInfo, [
        { name: 'slack.tmpl', contents: SLACK_TEMPLATE },
        { name: 'email.tmpl', contents: EMAIL_TEMPLATE },
      ]);

      await dragFilesOntoDropzone(page, page.getByTestId(DROPZONE_TEST_ID), filePaths);

      await expect(page.getByText('slack.tmpl', { exact: true })).toBeVisible();
      await expect(page.getByText('email.tmpl', { exact: true })).toBeVisible();
    });

    test('removes a single template file and keeps the rest', async ({ page }) => {
      await dropzoneInput(page).setInputFiles([
        { name: 'slack.tmpl', mimeType: 'text/plain', buffer: Buffer.from(SLACK_TEMPLATE) },
        { name: 'email.tmpl', mimeType: 'text/plain', buffer: Buffer.from(EMAIL_TEMPLATE) },
      ]);
      await expect(page.getByText('slack.tmpl', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Remove slack.tmpl' }).click();

      await expect(page.getByText('email.tmpl', { exact: true })).toBeVisible();
      await expect(page.getByText('slack.tmpl', { exact: true })).toBeHidden();
    });

    test('flags two template files sharing a name', async ({ page }) => {
      await dropzoneInput(page).setInputFiles([
        { name: 'slack.tmpl', mimeType: 'text/plain', buffer: Buffer.from(SLACK_TEMPLATE) },
      ]);
      await expect(page.getByText('slack.tmpl', { exact: true })).toBeVisible();

      // A second file with the same name would overwrite the first template on import.
      await dropzoneInput(page).setInputFiles([
        { name: 'slack.tmpl', mimeType: 'text/plain', buffer: Buffer.from(EMAIL_TEMPLATE) },
      ]);

      await expect(page.getByText('Duplicate template file name: "slack.tmpl"')).toBeVisible();
    });
  }
);
