import { FRENCH_FRANCE } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';
import pluginJson from '../../plugin.json';
import { ROUTES } from '../../constants';

test.use({ userPreferences: { language: FRENCH_FRANCE } });

test('should display default translation (en-US)', async ({ gotoAppPage }) => {
  const configPage = await gotoAppPage({ pluginId: pluginJson.id, path: ROUTES.Config });

  await expect(configPage.ctx.page.getByText('Is this translated')).toBeVisible();
});
