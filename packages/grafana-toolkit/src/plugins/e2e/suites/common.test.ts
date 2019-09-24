// ****************************************************************
// NOTE, This file is copied to plugins at runtime, it is not run locally
// ****************************************************************

import { e2eScenario, pages, takeScreenShot, plugins, Browser, Page } from '@grafana/e2e';

const sleep = (milliseconds: number) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

e2eScenario('Common Plugin Test', 'should pass', async (browser: Browser, page: Page) => {
  const settings = plugins.getEndToEndSettings();
  const pluginPage = pages.getPluginPage(settings.plugin.id);
  await pluginPage.init(page);
  await pluginPage.navigateTo();
  // TODO: find a better way to avoid the 'loading' page
  await sleep(500);

  const fileName = 'plugin-page';
  await takeScreenShot(page, fileName);
});
