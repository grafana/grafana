import { Browser, Page } from 'puppeteer-core';

import { e2eScenario, takeScreenShot, pluginCi, pages } from '@grafana/toolkit';

const sleep = (milliseconds: number) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

e2eScenario('Common Plugin Test', 'should pass', async (browser: Browser, page: Page) => {
  const settings = pluginCi.getEndToEndSettings();
  const pluginPage = pages.getPluginPage(settings.plugin.id);
  await pluginPage.init(page);
  await pluginPage.navigateTo();
  // TODO: find a better way to avoid the 'loading' page
  await sleep(500);

  const fileName = 'plugin-page';
  await takeScreenShot(page, fileName);
});
