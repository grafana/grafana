const path = require('path');

module.exports = [
  // '@storybook/preset-scss',
  {
    name: '@storybook/preset-typescript',
    options: {
      // Point the loader here to override the root "noEmit" compilerOption
      tsLoaderOptions: {
        // Transpile only means no type-checking from storybook, which greatly speeds up
        // builds. Types will be checked as part of the normal build process. This may also
        // be necessary for loading story source
        transpileOnly: true,
        configFile: path.resolve(__dirname, '../tsconfig.json'),
      },
      // We must use our config to ensure props and their comments are loaded
      tsDocgenLoaderOptions: {
        tsconfigPath: path.resolve(__dirname, '../tsconfig.json'),
        // https://github.com/styleguidist/react-docgen-typescript#parseroptions
        // @ts-ignore
        propFilter: prop => {
          if (prop.parent) {
            return !prop.parent.fileName.includes('node_modules/@types/react/');
          }

          return true;
        },
      },
    },
  },
  '@storybook/addon-docs/react/preset',
];
