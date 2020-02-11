import puppeteer, { Browser } from 'puppeteer-core';

export const launchBrowser = async (): Promise<Browser> => {
  const browserFetcher = puppeteer.createBrowserFetcher();
  const localRevisions = await browserFetcher.localRevisions();
  if (localRevisions.length === 0) {
    throw new Error('Could not launch browser because there is no local revisions.');
  }

  let executablePath = null;
  executablePath = browserFetcher.revisionInfo(localRevisions[0]).executablePath;

  const browser = await puppeteer.launch({
    headless: process.env.BROWSER ? false : true,
    slowMo: process.env.SLOWMO ? 100 : 0,
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: false,
    },
    args: ['--start-fullscreen'],
    executablePath,
  });

  return browser;
};
