var chromePaths = require('chrome-paths');

module.exports = {
  launch: {
    headless: process.env.BROWSER ? false : true,
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: false,
    },
    args: ['--start-fullscreen'],
    executablePath: chromePaths.chrome || chromePaths.chromium,
  },
};
