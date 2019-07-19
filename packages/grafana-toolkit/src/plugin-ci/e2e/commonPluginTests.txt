import { Browser, Page } from 'puppeteer-core';

import { e2eScenario, takeScreenShot, pluginCi, pages } from '@grafana/toolkit';

e2eScenario('Common Plugin Test', 'should pass', async (browser: Browser, page: Page) => {
  const settings = pluginCi.getEndToEndSettings();
  const pluginPage = pages.getPluginPage(settings.plugin.id);
  await pluginPage.init(page);
  await pluginPage.navigateTo();

  const fileName = 'plugin-page';
  await takeScreenShot(page, fileName);
});
