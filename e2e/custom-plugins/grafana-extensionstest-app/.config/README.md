# Default build configuration by Grafana

**This is an auto-generated directory and is not intended to be changed! ⚠️**

The `.config/` directory holds basic configuration for the different tools
that are used to develop, test and build the project. In order to make it updates easier we ask you to
not edit files in this folder to extend configuration.

## How to extend the basic configs?

Bear in mind that you are doing it at your own risk, and that extending any of the basic configuration can lead
to issues around working with the project.

### Extending the ESLint config

Edit the `.eslintrc` file in the project root in order to extend the ESLint configuration.

**Example:**

```json
{
  "extends": "./.config/.eslintrc",
  "rules": {
    "react/prop-types": "off"
  }
}
```

---

### Extending the Prettier config

Edit the `.prettierrc.js` file in the project root in order to extend the Prettier configuration.

**Example:**

```javascript
module.exports = {
  // Prettier configuration provided by Grafana scaffolding
  ...require('./.config/.prettierrc.js'),

  semi: false,
};
```

---

### Extending the Jest config

There are two configuration in the project root that belong to Jest: `jest-setup.js` and `jest.config.js`.

**`jest-setup.js`:** A file that is run before each test file in the suite is executed. We are using it to
set up the Jest DOM for the testing library and to apply some polyfills. ([link to Jest docs](https://jestjs.io/docs/configuration#setupfilesafterenv-array))

**`jest.config.js`:** The main Jest configuration file that extends the Grafana recommended setup. ([link to Jest docs](https://jestjs.io/docs/configuration))

#### ESM errors with Jest

A common issue with the current jest config involves importing an npm package that only offers an ESM build. These packages cause jest to error with `SyntaxError: Cannot use import statement outside a module`. To work around this, we provide a list of known packages to pass to the `[transformIgnorePatterns](https://jestjs.io/docs/configuration#transformignorepatterns-arraystring)` jest configuration property. If need be, this can be extended in the following way:

```javascript
process.env.TZ = 'UTC';
const { grafanaESModules, nodeModulesToTransform } = require('./config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana
  ...require('./.config/jest.config'),
  // Inform jest to only transform specific node_module packages.
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, 'packageName'])],
};
```

---

### Extending the TypeScript config

Edit the `tsconfig.json` file in the project root in order to extend the TypeScript configuration.

**Example:**

```json
{
  "extends": "./.config/tsconfig.json",
  "compilerOptions": {
    "preserveConstEnums": true
  }
}
```

---

### Extending the Webpack config

Follow these steps to extend the basic Webpack configuration that lives under `.config/`:

#### 1. Create a new Webpack configuration file

Create a new config file that is going to extend the basic one provided by Grafana.
It can live in the project root, e.g. `webpack.config.ts`.

#### 2. Merge the basic config provided by Grafana and your custom setup

We are going to use [`webpack-merge`](https://github.com/survivejs/webpack-merge) for this.

```typescript
// webpack.config.ts
import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import grafanaConfig from './.config/webpack/webpack.config';

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    // Add custom config here...
    output: {
      asyncChunks: true,
    },
  });
};

export default config;
```

#### 3. Update the `package.json` to use the new Webpack config

We need to update the `scripts` in the `package.json` to use the extended Webpack configuration.

**Update for `build`:**

```diff
-"build": "webpack -c ./.config/webpack/webpack.config.ts --env production",
+"build": "webpack -c ./webpack.config.ts --env production",
```

**Update for `dev`:**

```diff
-"dev": "webpack -w -c ./.config/webpack/webpack.config.ts --env development",
+"dev": "webpack -w -c ./webpack.config.ts --env development",
```

### Configure grafana image to use when running docker

By default, `grafana-enterprise` will be used as the docker image for all docker related commands. If you want to override this behavior, simply alter the `docker-compose.yaml` by adding the following build arg `grafana_image`.

**Example:**

```yaml
version: '3.7'

services:
  grafana:
    container_name: 'myorg-basic-app'
    build:
      context: ./.config
      args:
        grafana_version: ${GRAFANA_VERSION:-9.1.2}
        grafana_image: ${GRAFANA_IMAGE:-grafana}
```

In this example, we assign the environment variable `GRAFANA_IMAGE` to the build arg `grafana_image` with a default value of `grafana`. This will allow you to set the value while running the docker-compose commands, which might be convenient in some scenarios.

---
