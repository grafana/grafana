import puppeteer from 'puppeteer-core';
import { constants } from './constants';

export const downloadBrowserIfNeeded = async (): Promise<void> => {
  const browserFetcher = puppeteer.createBrowserFetcher();
  const localRevisions = await browserFetcher.localRevisions();
  if (localRevisions && localRevisions.length > 0) {
    console.log('Found a local revision for browser, exiting install.');
    return;
  }

  console.log('Did not find any local revisions for browser, downloading latest this might take a while.');
  await browserFetcher.download(constants.chromiumRevision, (downloaded, total) => {
    if (downloaded === total) {
      console.log('Chromium successfully downloaded');
    }
  });
};

beforeAll(async () => {
  console.log('Checking Chromium');
  jest.setTimeout(60 * 1000);
  await downloadBrowserIfNeeded();
});
