
> **@grafana/toolkit is currently in ALPHA**. Core API is unstable and can be a subject of breaking changes!

# grafana-toolkit
grafana-toolkit is CLI that enables efficient development of Grafana plugins


## Rationale
Historically, creating Grafana plugin was an exercise of reverse engineering and ceremony around testing, developing and eventually building the plugin. We want to help our community to focus on the core value of their plugins rather than all the setup required to develop them.

## Getting started

Setup new plugin with `grafana-toolkit plugin:create` command:

```sh
npx grafana-toolkit plugin:create my-grafana-plugin
cd my-grafana-plugin
yarn install
yarn dev
```

### Updating your plugin to use grafana-toolkit
In order to start using grafana-toolkit in your existing plugin you need to follow the steps below:
1. Add `@grafana/toolkit` package to your project by running `yarn add @grafana/toolkit` or `npm install @grafana/toolkit`
2. Create `tsconfig.json` file in the root dir of your plugin and paste the code below:
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

3. Create `.prettierrc.js` file in the root dir of your plugin and paste the code below:
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
With grafana-toolkit we put in your hands a CLI that addresses common tasks performed when working on Grafana plugin:
- `grafana-toolkit plugin:create`
- `grafana-toolkit plugin:dev`
- `grafana-toolkit plugin:test`
- `grafana-toolkit plugin:build`


### Creating plugin
`grafana-toolkit plugin:create plugin-name`

Creates new Grafana plugin from template.

If `plugin-name` is provided, the template will be downloaded to `./plugin-name` directory. Otherwise, it will be downloaded to current directory.

### Developing plugin
`grafana-toolkit plugin:dev`

Creates development build that's easy to play with and debug using common browser tooling

Available options:
- `-w`, `--watch` - run development task in a watch mode

### Testing plugin
`grafana-toolkit plugin:test`

Runs Jest against your codebase

Available options:
- `--watch` - runs tests in interactive watch mode
- `--coverage` - reports code coverage
- `-u`, `--updateSnapshot` - performs snapshots update
- `--testNamePattern=<regex>` - runs test with names that match provided regex (https://jestjs.io/docs/en/cli#testnamepattern-regex)
- `--testPathPattern=<regex>` - runs test with paths that match provided regex (https://jestjs.io/docs/en/cli#testpathpattern-regex)


### Building plugin
`grafana-toolkit plugin:build`

Creates production ready build of your plugin

## FAQ

### Which version should I use?
Please refer to [Grafana packages versioning guide](https://github.com/grafana/grafana/blob/master/packages/README.md#versioning)
### What tools does grafana-toolkit use?
grafana-toolkit comes with Typescript, TSLint, Prettier, Jest, CSS and SASS support.

### How to start using grafana-toolkit in my plugin?
See [Updating your plugin to use grafana-toolkit](#updating-your-plugin-to-use-grafana-toolkit)

### Can I use Typescript to develop Grafana plugins?
Yes! grafana-toolkit supports Typescript by default.


### How can I test my plugin?
grafana-toolkit comes with Jest as a test runner.

Internally at Grafana we use Enzyme. If you are developing React plugin and you want to configure Enzyme as a testing utility, you need to configure `enzyme-adapter-react`. To do so create `<YOUR_PLUGIN_DIR>/config/jest-setup.ts` file that will provide necessary setup. Copy the following code into that file to get Enzyme working with React:

```ts
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });
```

You can also setup Jest with shims of your needs by creating `jest-shim.ts` file in the same directory: `<YOUR_PLUGIN_DIR_>/config/jest-shim.ts`

### Can I provide custom setup for Jest?

You can provide Jest config via `package.json` file. For more details please refer to [Jest docs](https://jest-bot.github.io/jest/docs/configuration.html).

Currently we support following Jest config properties:
- [`snapshotSerializers`](https://jest-bot.github.io/jest/docs/configuration.html#snapshotserializers-array-string)
- [`moduleNameMapper`](https://jestjs.io/docs/en/configuration#modulenamemapper-object-string-string)

### How can I style my plugin?
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

In order for Grafana to pickup up you theme stylesheets you need to use `loadPluginCss` from `@grafana/runtime` package. Typically you would do that in the entrypoint of your plugin:

```ts
import { loadPluginCss } from '@grafana/runtime';

loadPluginCss({
  dark: 'plugins/<YOUR-PLUGIN-ID>/styles/dark.css',
  light: 'plugins/<YOUR-PLUGIN-ID>/styles/light.css',
});
```

You need to add `@grafana/runtime` to your plugin dependencies by running `yarn add @grafana/runtime` or `npm instal @grafana/runtime`

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
When building plugin with [`grafana-toolkit plugin:build`](#building-plugin) task, grafana-toolkit performs Prettier check. If the check detects any Prettier issues, the build will not pass. To avoid such situation we suggest developing plugin with [`grafana-toolkit plugin:dev --watch`](#developing-plugin) task running. This task tries to fix Prettier issues automatically.

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


