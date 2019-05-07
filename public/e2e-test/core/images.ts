import fs from 'fs';
import { PNG } from 'pngjs';
import { Page } from 'puppeteer-core';
import pixelmatch from 'pixelmatch';

import { constants } from './constants';

export const takeScreenShot = async (page: Page, fileName: string) => {
  const outputFolderExists = fs.existsSync(constants.screenShotsOutputDir);
  if (!outputFolderExists) {
    fs.mkdirSync(constants.screenShotsOutputDir);
  }
  const path = `${constants.screenShotsOutputDir}/${fileName}.png`;
  await page.screenshot({ path, type: 'png', fullPage: false });
};

export const compareScreenShots = async (fileName: string) =>
  new Promise(resolve => {
    let filesRead = 0;

    const doneReading = () => {
      if (++filesRead < 2) {
        return;
      }

      expect(screenShotFromTest.width).toEqual(screenShotFromTruth.width);
      expect(screenShotFromTest.height).toEqual(screenShotFromTruth.height);

      const diff = new PNG({ width: screenShotFromTest.width, height: screenShotFromTruth.height });
      const numDiffPixels = pixelmatch(
        screenShotFromTest.data,
        screenShotFromTruth.data,
        diff.data,
        screenShotFromTest.width,
        screenShotFromTest.height,
        { threshold: 0.1 }
      );

      expect(numDiffPixels).toBe(0);
      resolve();
    };

    const screenShotFromTest = fs
      .createReadStream(`${constants.screenShotsOutputDir}/${fileName}.png`)
      .pipe(new PNG())
      .on('parsed', doneReading);
    const screenShotFromTruth = fs
      .createReadStream(`${constants.screenShotsTruthDir}/${fileName}.png`)
      .pipe(new PNG())
      .on('parsed', doneReading);
  });
