module.exports = (path, options) => {
  // Call the defaultResolver, so we leverage its cache, error handling, etc.
  return options.defaultResolver(path, {
    ...options,
    // Use packageFilter to process parsed `package.json` before the resolution (see https://www.npmjs.com/package/resolve#resolveid-opts-cb)
    packageFilter: (pkg) => {
      // jest-environment-jsdom 28+ tries to use browser exports instead of default exports,
      // but react-colorful only offers an ESM browser export and not a CommonJS one.
      // Deleting exports forces fallback to the CommonJS "main" entry.
      if (pkg.name === 'react-colorful') {
        delete pkg['exports'];
        delete pkg['module'];
      }
      // Jest + jsdom acts like a browser (i.e., it looks for "browser" imports
      // under pkg.exports), but msw knows that you're operating in a Node
      // environment:
      //
      // https://github.com/mswjs/msw/issues/1786#issuecomment-1782559851
      //
      // The MSW project's recommended workaround is to disable Jest's
      // customExportConditions completely, so no packages use their browser's
      // versions.  We'll instead clear export conditions only for MSW.
      //
      // Taken from https://github.com/mswjs/msw/issues/1786#issuecomment-1787730599
      if (pkg.name === 'msw') {
        delete pkg.exports['./node'].browser;
      }
      if (pkg.name === '@mswjs/interceptors') {
        delete pkg.exports;
      }
      return pkg;
    },
  });
};
