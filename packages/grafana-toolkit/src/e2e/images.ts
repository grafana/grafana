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

      if (screenShotFromTest.width !== screenShotFromTruth.width) {
        throw new Error(
          `The screenshot:[${fileName}] taken during the test has a ` +
            `width:[${screenShotFromTest.width}] that differs from the ` +
            `expected: [${screenShotFromTruth.width}].`
        );
      }

      if (screenShotFromTest.height !== screenShotFromTruth.height) {
        throw new Error(
          `The screenshot:[${fileName}] taken during the test has a ` +
            `height:[${screenShotFromTest.height}] that differs from the ` +
            `expected: [${screenShotFromTruth.height}].`
        );
      }

      const diff = new PNG({ width: screenShotFromTest.width, height: screenShotFromTruth.height });
      const numDiffPixels = pixelmatch(
        screenShotFromTest.data,
        screenShotFromTruth.data,
        diff.data,
        screenShotFromTest.width,
        screenShotFromTest.height,
        { threshold: 0.1 }
      );

      if (numDiffPixels !== 0) {
        const localMessage =
          `\nCompare the output from expected:[${constants.screenShotsTruthDir}] ` +
          `with outcome:[${constants.screenShotsOutputDir}]`;
        const circleCIMessage = '\nCheck the Artifacts tab in the CircleCi build output for the actual screenshots.';
        const checkMessage = process.env.CIRCLE_SHA1 ? circleCIMessage : localMessage;
        let msg =
          `\nThe screenshot:[${constants.screenShotsOutputDir}/${fileName}.png] ` +
          `taken during the test differs by:[${numDiffPixels}] pixels from the expected.`;
        msg += '\n';
        msg += checkMessage;
        msg += '\n';
        msg += '\n  If the difference between expected and outcome is NOT acceptable then do the following:';
        msg += '\n    - Check the code for changes that causes this difference, fix that and retry.';
        msg += '\n';
        msg += '\n  If the difference between expected and outcome is acceptable then do the following:';
        msg += '\n    - Replace the expected image with the outcome and retry.';
        msg += '\n';
        throw new Error(msg);
      }

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
