const BlinkDiff = require('blink-diff');

function compareSnapshotsPlugin(args) {
  args.threshold = args.threshold || 0.001;

  return new Promise((resolve, reject) => {
    const diff = new BlinkDiff({
      imageAPath: args.pathToFileA,
      imageBPath: args.pathToFileB,
      thresholdType: BlinkDiff.THRESHOLD_PERCENT,
      threshold: args.threshold,
      imageOutputPath: args.pathToFileA.replace('.png', '.diff.png'),
    });

    diff.run((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

module.exports = compareSnapshotsPlugin;
