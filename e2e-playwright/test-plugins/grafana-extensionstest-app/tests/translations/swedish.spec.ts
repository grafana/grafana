import { SWEDISH_SWEDEN } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';
import pluginJson from '../../plugin.json';
import { ROUTES } from '../../constants';

test.use({ userPreferences: { language: SWEDISH_SWEDEN } });

test('should display correct translation', async ({ gotoAppPage }) => {
  const configPage = await gotoAppPage({ pluginId: pluginJson.id, path: ROUTES.Config });

  await expect(configPage.ctx.page.getByText('Det här är översatt')).toBeVisible();
});
