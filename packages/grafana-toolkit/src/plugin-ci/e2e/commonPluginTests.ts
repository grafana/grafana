import { Browser, Page } from 'puppeteer-core';

import { e2eScenario, takeScreenShot } from '@grafana/toolkit';

e2eScenario('Base Tests', 'should pass', async (browser: Browser, page: Page) => {
  const fileName = 'simple-test';
  await takeScreenShot(page, fileName);
});
