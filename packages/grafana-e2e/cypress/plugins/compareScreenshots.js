'use strict';
const { writeFileSync } = require('fs');
const { resolve } = require('path');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');

const compareScreenshots = async ({ config, screenshotsFolder, specName }) => {
  const name = config.name || config; // @todo use `??`
  const threshold = config.threshold || 0.001; // @todo use `??`

  const imageAPath = `${screenshotsFolder}/${specName}/${name}.png`;
  const imageBPath = resolve(`${screenshotsFolder}/../expected/${specName}/${name}.png`);

  const imageA = PNG.sync.read(fs.readFileSync(imageAPath));
  const imageB = PNG.sync.read(fs.readFileSync(imageBPath));
  const { width, height } = imageA;

  const diff = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(imageA.data, imageB.data, diff.data, width, height, { threshold });

  const imageOutputPath = screenshotsFolder.endsWith('actual') ? imageAPath.replace('.png', '.diff.png') : undefined;
  writeFileSync(imageOutputPath, PNG.sync.write(diff));

  if (mismatchedPixels > 0) {
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
