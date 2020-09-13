'use strict';
const BlinkDiff = require('blink-diff');
const { resolve } = require('path');

// @todo use npmjs.com/pixelmatch or an available cypress plugin
const compareScreenshots = async ({ config, screenshotsFolder, specName }) => {
  const name = config.name || config; // @todo use `??`
  const threshold = config.threshold || 0.001; // @todo use `??`

  const imageAPath = `${screenshotsFolder}/${specName}/${name}.png`;
  const imageBPath = resolve(`${screenshotsFolder}/../expected/${specName}/${name}.png`);

  const imageOutputPath = screenshotsFolder.endsWith('actual') ? imageAPath.replace('.png', '.diff.png') : undefined;

  const { code } = await new Promise((resolve, reject) => {
    new BlinkDiff({
      imageAPath,
      imageBPath,
      imageOutputPath,
      threshold,
      thresholdType: BlinkDiff.THRESHOLD_PERCENT,
    }).run((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });

  if (code <= 1) {
    let msg = `\nThe screenshot [${imageAPath}] differs from [${imageBPath}]`;
    msg += '\n';
    msg += '\nCheck the Artifacts tab in the CircleCi build output for the actual screenshots.';
    msg += '\n';
    msg += '\n  If the difference between expected and outcome is NOT acceptable then do the following:';
    msg += '\n    - Check the code for changes that causes this difference, fix that and retry.';
    msg += '\n';
    msg += '\n  If the difference between expected and outcome is acceptable then do the following:';
    msg += '\n    - Replace the expected image with the outcome and retry.';
    msg += '\n';
    throw new Error(msg);
  } else {
    // Must return a value
    return true;
  }
};

module.exports = compareScreenshots;
