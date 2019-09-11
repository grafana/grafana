
# grafana-toolkit
grafana-toolkit is CLI that enables efficient development of Grafana extensions

## Rationale
Historically, creating Grafana extension was an exercise of reverse engineering and ceremony around testing, developing and eventually building the plugin. We want to help our community to focus on the core value of their plugins rather than all the setup required to develop an extension.

## Installation

You can either add grafana-toolkit to your extension's `package.json` file by running
`yarn add @grafana/toolkit`  `npm instal @grafana/toolkit` or use one of our extension templates:
- [React Panel](https://github.com/grafana/simple-react-panel)
- [Angular Panel](https://github.com/grafana/simple-angular-panel)

### Updating your extension to use grafana-toolkit
In order to start using grafana-toolkit in your extension you need to follow the steps below:
1. Add `@grafana/toolkit` package to your project
2. Create `tsconfig.json` file in the root dir of your extension and paste the code below:
```json
{
  "extends": "./node_modules/@grafana/toolkit/src/config/tsconfig.plugin.json",
  "include": ["src", "types"],
  "compilerOptions": {
    "rootDir": "./src",
    "baseUrl": "./src",
    "typeRoots": ["./node_modules/@types"]
  }
}
```

3. Create `.prettierrc.js` file in the root dir of your extension and paste the code below:
```js
module.exports = {
  ...require("./node_modules/@grafana/toolkit/src/config/prettier.plugin.config.json"),
};
```

4. In your `package.json` file add following scripts:
```json
"scripts": {
  "build": "grafana-toolkit plugin:build",
  "test": "grafana-toolkit plugin:test",
  "dev": "grafana-toolkit plugin:dev",
  "watch": "grafana-toolkit plugin:dev --watch"
},
```

## Usage
With grafana-toolkit we put in your hands a CLI that addresses common tasks performed when working on Grafana extension:
- `grafana-toolkit plugin:test`
- `grafana-toolkit plugin:dev`
- `grafana-toolkit plugin:build`


### Developing extensions
`grafana-toolkit plugin:dev`

Creates development build that's easy to play with and debug using common browser tooling

Available options:
- `-w`, `--watch` - run development task in a watch mode

### Testing extensions
`grafana-toolkit plugin:test`

Runs Jest against your codebase

Available options:
- `--watch` - runs tests in interactive watch mode
- `--coverage` - reports code coverage
- `-u`, `--updateSnapshot` - performs snapshots update
- `--testNamePattern=<regex>` - runs test with names that match provided regex (https://jestjs.io/docs/en/cli#testnamepattern-regex)
- `--testPathPattern=<regex>` - runs test with paths that match provided regex (https://jestjs.io/docs/en/cli#testpathpattern-regex)


### Building extensions
`grafana-toolkit plugin:build`

Creates production ready build of your extension

## FAQ

### What tools does grafana-toolkit use?
grafana-toolkit comes with Typescript, TSLint, Prettier, Jest, CSS and SASS support.

### How to start using grafana-toolkit in my extension?
See [Updating your extension to use grafana-toolkit](#updating-your-extension-to-use-grafana-toolkit)
### Can I use Typescript to develop Grafana extensions?
Yes! grafana-toolkit supports Typescript by default.


### How can I test my extension?
grafana-toolkit comes with Jest as a test runner.

Internally at Grafana we use Enzyme. If you are developing React extension and you want to configure Enzyme as a testing utility, you need to configure `enzyme-adapter-react`. To do so create `[YOUR_EXTENSION]/config/jest-setup.ts` file that will provide necessary setup. Copy the following code into that file to get Enzyme working with React:

```ts
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });
```

You can also setup Jest with shims of your needs by creating `jest-shim.ts` file in the same directory: `[YOUR_EXTENSION]/config/jest-shim.ts`

### Can I provide custom setup for Jest?

You can provide Jest config via `package.json` file. For more details please refer to [Jest docs](https://jest-bot.github.io/jest/docs/configuration.html).

Currently we support following Jest config properties:
- [`snapshotSerializers`](https://jest-bot.github.io/jest/docs/configuration.html#snapshotserializers-array-string)
- [`moduleNameMapper`](https://jestjs.io/docs/en/configuration#modulenamemapper-object-string-string)

### How can I style my extension?
We support pure CSS, SASS and CSS-in-JS approach (via [Emotion](https://emotion.sh/)).

#### Single CSS or SASS file

Create your CSS or SASS file and import it in your plugin entry point (typically `module.ts`):

```ts
import 'path/to/your/css_or_sass'
```
The styles will be injected via `style` tag during runtime.

> Note that imported static assets will be inlined as base64 URIs. *This can be subject of change in the future!*

#### Theme specific stylesheets

If you want to provide different stylesheets for dark/light theme, create `dark.[css|scss]` and `light.[css|scss]` files in `src/styles` directory of your plugin. grafana-toolkit will generate theme specific stylesheets that will end up in `dist/styles` directory.

In order for Grafana to pickup up you theme stylesheets you need to use `loadPluginCss` from `@grafana/runtime` package. Typically you would do that in the entrypoint of your extension:

```ts
import { loadPluginCss } from '@grafana/runtime';

loadPluginCss({
  dark: 'plugins/<YOUR-EXTENSION-NAME>/styles/dark.css',
  light: 'plugins/<YOUR-EXTENSION-NAME>/styles/light.css',
});
```

You need to add `@grafana/runtime` to your extension dependencies by running `yarn add @grafana/runtime` or `npm instal @grafana/runtime`

> Note that in this case static files (png, svg, json, html) are all copied to dist directory when the plugin is bundled. Relative paths to those files does not change!

#### Emotion

Starting from Grafana 6.2 *our suggested way* for styling plugins is by using [Emotion](https://emotion.sh). It's a CSS-in-JS library that we use internally at Grafana. The biggest advantage of using Emotion is that you will get access to Grafana Theme variables.

To use start using Emotion you first need to add it to your plugin dependencies:

```
  yarn add "@emotion/core"@10.0.14
```

Then, import `css` function from emotion:

```ts
import { css } from 'emotion'
```

Now you are ready to implement your styles:

```tsx
const MyComponent = () => {
  return <div className={css`background: red;`} />
}
```
To learn more about using Grafana theme please refer to [Theme usage guide](https://github.com/grafana/grafana/blob/master/style_guides/themes.md#react)

> We do not support Emotion's `css` prop. Use className instead!

### Can I adjust Typescript configuration to suit my needs?

Yes! However, it's important that your `tsconfig.json` file contains the following lines:

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

### Can I adjust TSLint configuration to suit my needs?
grafana-toolkit comes with [default config for TSLint](https://github.com/grafana/grafana/blob/master/packages/grafana-toolkit/src/config/tslint.plugin.json). As for now there is now way to customise TSLint config.


### How is Prettier integrated into  grafana-toolkit workflow?
When building extension with [`grafana-toolkit plugin:build`](#building-extensions) task, grafana-toolkit performs Prettier check. If the check detects any Prettier issues, the build will not pass. To avoid such situation we suggest developing plugin with [`grafana-toolkit plugin:dev --watch`](#developing-extensions) task running. This task tries to fix Prettier issues automatically.

### My editor does not respect Prettier config, what should I do?
In order for your editor to pickup our Prettier config you need to create `.prettierrc.js` file in the root directory of your plugin with following content:

```js
module.exports = {
  ...require("./node_modules/@grafana/toolkit/src/config/prettier.plugin.config.json"),
};
```

## Contributing to grafana-toolkit

Typically plugins should be developed using the `@grafana/toolkit` installed from npm.  However, when working on the toolkit, you may want to use the local version. To do that follow the steps below:

1. Clone [Grafana repository](https://github.com/grafana/grafana)
2. Navigate to the directory you have cloned Grafana repo to and run `yarn install --pure-lockfile`
3. Navigate to `<GRAFANA_DIR>/packages/grafana-toolkit` and run `yarn link`
2. Navigate to your plugin directory and run `npx grafana-toolkit plugin:dev --yarnlink`. This will add all dependencies required by grafana-toolkit to your project as well as link your local grafana-toolkit version to be used by the plugin.


