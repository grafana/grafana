
# grafana-toolkikt
grafana-toolkit is a simple CLI that enables efficient Grafana extensions development

## Why grafana-toolkit?
Historically, creating Grafana extension was an excercise of reverse engineering and ceremeny around testing, developing and eventually building the plugin. We want to help our community to focus on the core value of their plugins rather than all the setup required to develop an extension.

With grafana-toolkit we put a simple CLI in your hands that address common tasks performed when developing an extension:
- `plugin:create`
- `plugin:test`
- `plugin:dev`
- `plugin:build`

### Scaffolding extensions

__TODO:__ Implement the task...

Grafana supports 2 types of extensions: Panels and Datasources. Panels can be developed using either React or AngularJS(legacy).
To scaffold new extension use `npx grafana-toolkit plugin:create`. This will guide you through the basic extension setup as well as create common directory structure and files from our extension templates. All of the templates comes with `grafana-toolkit` tasks available via yarn scripts: `yarn dev`, `yarn test` & `yarn build`.


### Developing extensions

`plugin:dev`
> Creates development build that's easy to play with and debug using common browser tooling

Available options:
- `-w`, `--watch` - run development task in a watch

### Testing extensions
`plugin:test`

> Runs Jest against your codebase

Available options:
- `--watch` - runs tests in interactive watch mode
- `--coverage` - reports code coverage
- `-u`, `--updateSnapshot` - performs snapshots update
- `--testNamePattern=<regex>` - runs test with names that match provided regex (https://jestjs.io/docs/en/cli#testnamepattern-regex)
- `--testPathPattern=<regex>` - runs test with paths that match provided regex (https://jestjs.io/docs/en/cli#testpathpattern-regex)

#### Configuring Enzyme
We are not opinionated about tool used for implmenting tests. Internally at Grafana we use Enzyme. If you want to configure Enzyme as a testing utility, you need to configure `enzyme-adapter-react`. To do so, you need to create `[YOUR_EXTENSION]/config/jest-setup.ts` file that will provide React/Enzyme setup. Simply copy following code into that file to get Enzyme working with React:

```ts
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });
```

grafana-toolkit will use that file as Jest's setup file.

You can also setup Jest with shims of your needs by creating `jest-shim.ts` file in the same directory: `[YOUR_EXTENSION]/config/jest-shim.ts`

Adidtionaly, you can provide Jest config via package.json file. For more details please refer to [Jest docs](https://jest-bot.github.io/jest/docs/configuration.html).

We support following Jest config properties:
- [`snapshotSerializers`](https://jest-bot.github.io/jest/docs/configuration.html#snapshotserializers-array-string)
- [`moduleNameMapper`](https://jestjs.io/docs/en/configuration#modulenamemapper-object-string-string)


### Building extensions

`plugin:build`

> Creates production ready build of your extension


## grafana-toolkit tooling overview

### Typescript
grafana-toolkit by default supports Typescript

#### Typescript configuration

> Only applies if you are setting up an extension not using [plugin:create](#scaffolding-extensions) task

To configure Typescript create `tsconfig.json` file in the root dir of your app. grafana-toolkit comes with [default Typescript config](https://github.com/grafana/grafana/blob/master/packages/grafana-toolkit/src/config/tsconfig.plugin.json). In order for Typescript to be able to pickup your source files you need to extend that config as follows:

```json
{
  "extends": "./node_modules/@grafana/toolkit/src/config/tsconfig.plugin.json",
  "include": ["src"],
  "compilerOptions": {
    "rootDir": "./src",
    "typeRoots": ["./node_modules/@types"]
  }
}
```

### TSLint
grafana-toolkit templates comes with [default config for TSLint](https://github.com/grafana/grafana/blob/master/packages/grafana-toolkit/src/config/tslint.plugin.json). As for now there is now way to customise TSLint config.

### Prettier
When building extension with [`plugin:build`](#building-extensions) task, grafana-toolkit performs Prettier check. If the check detects any Prettier issues, the build will not pass. To avoid such situation we suggest developing plugin with [`plugin:dev --watch`](#developing-extensions) task running, that trys to fix Prettier issues automatically.

> Only applies if you are setting up an extension not using [plugin:create](#scaffolding-extensions) task

In order for your IDE to pickup our Prettier config you need ti ceate `.prettierrc.js` file in the root directory of your plugin with following contents:

```js
module.exports = {
  ...require("./node_modules/@grafana/toolkit/src/config/prettier.plugin.config.json"),
};
```

### Working with CSS & static assets
We support pure css, SASS and css-in-js approach (via Emotion).

1. Single css/sass file

Create your css/sass file and import it in your plugin entry point (typically module.ts):

```ts
import 'path/to/your/css_or_sass
```
The styles will be injected via `style` tag during runtime.

Note that imported static assets will be inlined as base64 URIs. *This can be a subject of change in the future!*

2. Theme specific css/sass files

If you want to provide different stylesheets for dark/light theme, create `dark.[css|scss]` and `light.[css|scss]` files in `src/styles` directory of your plugin. Based on that grafana-toolkit will generate stylesheets that will end up in `dist/styles` directory.

In order for Grafana to pickup up you theme stylesheets you need to use `loadPluginCss` from `@grafana/runtime` package. Typically you would do that in the entrypoint of your extension:

```ts
import { loadPluginCss } from '@grafana/runtime';

loadPluginCss({
  dark: 'plugins/<YOUR-EXTENSION-NAME>/styles/dark.css',
  light: 'plugins/<YOUR-EXTENSION-NAME>/styles/light.css',
});
```

Note that in this case static files (png, svg, json, html) are all copied to dist directory when the plugin is bundled. Relative paths to those files does not change!

3. Emotion

Starting from Grafana 6.2 *our suggested way* of styling plugins is by using [Emotion](https://emotion.sh). It's a css-in-js library that we use internaly at Grafana. The biggest advantage of using Emotion is that you will get access to Grafana Theme variables.

To use start using Emotion you first need to add it to your plugin dependencies:

```
  yarn add "@emotion/core"@10.0.14
```

Then, import `css` function from emotion:

```import { css } from 'emotion'```

And start implementing your styles:

```tsx
const MyComponent = () => {
  return <div className={css`background: red;`} />
}
```
TO learn more about using Grafana theme please refer to [Theme usage guide](https://github.com/grafana/grafana/blob/master/style_guides/themes.md#react)

> NOTE: We do not support Emotion's `css` prop. Use className instead!

## Contributing to grafana-toolkit

Typically plugins should be developed using the `@grafana/toolkit` installed from npm.  However, when working on the toolkit, you may want to use the local version. To do that follow the steps below:

1. Clone [Grafana repository](https://github.com/grafana/grafana)
2. Navigate to the directory you have cloned Grafana repo to and run `yarn install --pure-lockfile`
3. Navigate to `<GRAFANA_DIR>/packages/grafana-toolkit` and run `yarn link`
2. Navigate to your plugin directory and run `npx grafana-toolkit plugin:dev --yarnlink`. This will add all dependencies required by grafana-toolkit to your project as well as link your local grafana-toolkit version to be used by the plugin.


