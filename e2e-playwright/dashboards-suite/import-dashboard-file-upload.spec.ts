import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/TestDashboard.json';
import { DROPZONE_TEST_ID, dragFilesOntoDropzone, dropzoneInput, writeFilesForDrag } from '../utils/dropzone-helpers';

/**
 * The upload half of /dashboard/import. `import-dashboard.spec.ts` covers pasting JSON into the
 * textarea, which never touches the `FileDropzone` — reading the file, parsing it and handing the
 * result to the import form only happens on this path.
 */
test.describe(
  'Import a dashboard from a file',
  {
    tag: ['@dashboards'],
  },
  () => {
    let importedUid = '';

    function dashboardFixture(suffix: string) {
      return { ...testDashboard, uid: `dropzone-${suffix}`, title: `Kubernetes cluster overview ${suffix}` };
    }

    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard/import');
      await expect(page.getByTestId(DROPZONE_TEST_ID)).toBeVisible();
    });

    test.afterEach(async ({ request }) => {
      if (importedUid) {
        await request.delete(`/api/dashboards/uid/${importedUid}`);
        importedUid = '';
      }
    });

    test('imports a dashboard chosen through the file picker', async ({ page, selectors }) => {
      const dashboard = dashboardFixture(crypto.randomUUID().slice(0, 8));

      await dropzoneInput(page).setInputFiles({
        name: 'kubernetes-cluster-overview.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(dashboard)),
      });

      // The name field is seeded from the parsed file, so its value proves the FileReader result
      // reached the import form rather than just that a file was accepted.
      await expect(page.getByTestId(selectors.components.ImportDashboardForm.name)).toHaveValue(dashboard.title);

      await page.getByTestId(selectors.components.ImportDashboardForm.submit).click();

      await page.waitForURL('**/d/**');
      importedUid = new URL(page.url()).pathname.split('/')[2];

      await expect(page.getByTestId(selectors.components.Breadcrumbs.breadcrumb(dashboard.title))).toBeVisible();
      await expect(page.getByText('Gauge Example')).toBeVisible();
      await expect(page.getByText('Time series example')).toBeVisible();
    });

    test('imports a dashboard dragged onto the dropzone', async ({ page, selectors }, testInfo) => {
      const dashboard = dashboardFixture(crypto.randomUUID().slice(0, 8));
      const [filePath] = writeFilesForDrag(testInfo, [
        { name: 'kubernetes-cluster-overview.json', contents: JSON.stringify(dashboard) },
      ]);

      await dragFilesOntoDropzone(page, page.getByTestId(DROPZONE_TEST_ID), [filePath]);

      await expect(page.getByTestId(selectors.components.ImportDashboardForm.name)).toHaveValue(dashboard.title);

      await page.getByTestId(selectors.components.ImportDashboardForm.submit).click();

      await page.waitForURL('**/d/**');
      importedUid = new URL(page.url()).pathname.split('/')[2];

      await expect(page.getByTestId(selectors.components.Breadcrumbs.breadcrumb(dashboard.title))).toBeVisible();
    });

    test('rejects a file whose type is not accepted', async ({ page, selectors }) => {
      await dropzoneInput(page).setInputFiles({
        name: 'screenshot.png',
        mimeType: 'image/png',
        buffer: Buffer.from('not-a-dashboard'),
      });

      const rejection = page
        .getByTestId(selectors.components.Alert.alertV2('error'))
        .filter({ hasText: 'File type must be' });
      await expect(rejection).toBeVisible();
      await expect(rejection).toContainText('.json');

      await expect(page.getByTestId(selectors.components.ImportDashboardForm.name)).toBeHidden();
    });

    test('reports a parse failure and still imports a valid file afterwards', async ({ page, selectors }) => {
      await dropzoneInput(page).setInputFiles({
        name: 'truncated.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{ "title": "Kubernetes cluster overview"'),
      });

      await expect(
        page.getByTestId(selectors.components.Alert.alertV2('error')).filter({ hasText: 'Import failed' })
      ).toBeVisible();

      const dashboard = dashboardFixture(crypto.randomUUID().slice(0, 8));
      await dropzoneInput(page).setInputFiles({
        name: 'kubernetes-cluster-overview.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(dashboard)),
      });

      await expect(page.getByTestId(selectors.components.ImportDashboardForm.name)).toHaveValue(dashboard.title);
    });

    test('opens the file picker when the dropzone is activated from the keyboard', async ({ page }) => {
      const dropzone = page.getByTestId(DROPZONE_TEST_ID);
      await dropzone.focus();

      const fileChooser = page.waitForEvent('filechooser');
      await page.keyboard.press('Enter');

      // The import page takes a single dashboard file, which the picker has to reflect.
      expect((await fileChooser).isMultiple()).toBe(false);
    });
  }
);
