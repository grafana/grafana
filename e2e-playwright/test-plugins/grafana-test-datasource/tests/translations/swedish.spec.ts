import { SWEDISH_SWEDEN } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';
import pluginJson from '../../plugin.json';

test.use({ userPreferences: { language: SWEDISH_SWEDEN } });

test('should display correct translation', async ({ createDataSourceConfigPage }) => {
  const configPage = await createDataSourceConfigPage({ type: pluginJson.id });

  await expect(configPage.ctx.page.getByLabel('API-nyckel')).toBeVisible();
});
