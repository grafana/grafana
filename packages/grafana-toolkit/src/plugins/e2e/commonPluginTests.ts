import { Browser, Page } from 'puppeteer-core';

import { e2eScenario, pages, takeScreenShot } from '@grafana/toolkit/src/e2e';
import { getEndToEndSettings } from '@grafana/toolkit/src/plugins';

// ****************************************************************
// NOTE, This file is copied to plugins at runtime, it is not run locally
// ****************************************************************

const sleep = (milliseconds: number) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

e2eScenario({
  describeName: 'Common Plugin Test',
  itName: 'should pass',
  scenario: async (browser: Browser, page: Page) => {
    const settings = getEndToEndSettings();
    const pluginPage = pages.getPluginPage(settings.plugin.id);
    await pluginPage.init(page);
    await pluginPage.navigateTo();
    // TODO: find a better way to avoid the 'loading' page
    await sleep(500);

    const fileName = 'plugin-page';
    await takeScreenShot(page, fileName);
  },
});
