import { FRENCH_FRANCE } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';
import pluginJson from '../../plugin.json';

test.use({ userPreferences: { language: FRENCH_FRANCE } });

test('should display default translation (en-US)', async ({ createDataSourceConfigPage }) => {
  const configPage = await createDataSourceConfigPage({ type: pluginJson.id });

  await expect(configPage.ctx.page.getByLabel('API Key')).toBeVisible();
});
