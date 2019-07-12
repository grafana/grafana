# Grafana Toolkit

Make sure to run `yarn install` before trying anything!  Otherwise you may see unknown command grafana-toolkit and spend a while tracking that down.



## Internal development
Typically plugins should be developed using the `@grafana/toolkit` import from npm.  However, when working on the toolkit, you may want to use the local version while underdevelopment.  This works, but is a little flakey.

1. navigate to `packages/grafana-toolkit` and run `yarn link`.
2. in your plugin, run `npx grafana-toolkit plugin:dev --yarnlink`

Step 2 will add all the same dependencies to your development plugin as the toolkit.  These are typically used from the node_modules folder


TODO: Experiment with [yalc](https://github.com/whitecolor/yalc) for linking packages



### Publishing to npm
The publish process is now manual. Follow the steps to publish @grafana/toolkit to npm
1. From Grafana root dir: `./node_modules/.bin/grafana-toolkit toolkit:build`
2. `cd packages/grafana-toolkit/dist`
3. Open `package.json`, change version according to current version on npm (https://www.npmjs.com/package/@grafana/toolkit)
4. Run `npm publish --tag next` - for dev purposes we now publish on `next` channel

Note, that for publishing you need to be part of Grafana npm org and you need to be logged in to npm in your terminal (`npm login`).


## Grafana extensions development with grafana-toolkit overview
### Available tasks
#### `grafana-toolkit plugin:test`
Runs Jest against your codebase. See [Tests](#tests) for more details.

Available options:
- `-u, --updateSnapshot` - performs snapshots update
- `--coverage` - reports code coverage

#### `grafana-toolkit plugin:dev`
Compiles plugin in development mode.

Available options:
- `-w, --watch` - runs `plugin:dev` task in watch mode
#### `grafana-toolkit plugin:build`
Compiles plugin in production mode


### Typescript
To configure Typescript create `tsconfig.json` file in the root dir of your app. grafana-toolkit comes with default tsconfig located in `packages/grafana-toolkit/src/config/tsconfig.plugin.ts`. In order for Typescript to be able to pickup your source files you need to extend that config as follows:

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
grafana-toolkit comes with default config for TSLint, that's located in `packages/grafana-toolkit/src/config/tslint.plugin.ts`. As for now there is now way to customise TSLint config.

### Tests
grafana-toolkit comes with Jest as a test runner. It runs tests according to common config locted in `packages/grafana-toolkit/src/config/jest.plugin.config.ts`.

For now the config is not extendable, but our goal is to enable custom jest config via jest.config or package.json file. This might be required in the future if you want to use i.e. `enzyme-to-json` snapshots serializer. For that particular serializer we can also utilise it's API and add initialisation in the setup files (https://github.com/adriantoine/enzyme-to-json#serializer-in-unit-tests). We need to test that approach first.

#### Jest setup
We are not opinionated about tool used for implmenting tests. Internally at Grafana we use Enzyme. If you want to configure Enzyme as a testing utility, you need to configure enzyme-adapter-react. To do so, you need to create `[YOUR_APP]/config/jest-setup.ts` file that will provide React/Enzyme setup. Simply copy following code into that file to get Enzyme working with React:

```ts
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });
```

grafana-toolkit will use that file as Jest's setup file. You can also setup Jest with shims of your needs by creating `jest-shim.ts` file in the same directory: `[YOUR_APP]/config/jest-shim.ts`

Adidtionaly, you can also provide additional Jest config via package.json file. For more details please refer to [Jest docs](https://jest-bot.github.io/jest/docs/configuration.html#verbose-boolean). Currently we support following properties:
- [`snapshotSerializers`](https://jest-bot.github.io/jest/docs/configuration.html#snapshotserializers-array-string)


## Working with CSS & static assets
We support pure css, SASS and CSS in JS approach (via Emotion).

1. Single css/sass file
Create your css/sass file and import it in your plugin entry point (typically module.ts):

```ts
import 'path/to/your/css_or_sass
```
The styles will be injected via `style` tag during runtime.

Note, that imported static assets will be inlined as base64 URIs. *This can be a subject of change in the future!*

2. Theme specific css/sass files
If you want to provide different stylesheets for dark/light theme, create `dark.[css|scss]` and `light.[css|scss]` files in `src/styles` directory of your plugin. Based on that we will generate stylesheets that will end up in `dist/styles` directory.

TODO: add note about loadPluginCss

Note that static files (png, svg, json, html) are all copied to dist directory when the plugin is bundled. Relative paths to those files does not change.

3. Emotion
Starting from Grafana 6.2 our suggested way of styling plugins is by using [Emotion](https://emotion.sh). It's a css-in-js library that we use internaly at Grafana. The biggest advantage of using Emotion is that you will get access to Grafana Theme variables.

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

Using themes: TODO, for now please refer to [internal guide](../../style_guides/themes.md)

> NOTE: We do not support Emotion's `css` prop. Use className instead!

## Prettier
When `plugin:build` task is performed we run Prettier check. In order for your IDE to pickup our Prettier config we suggest creating `.prettierrc.js` file in the root directory of your plugin with following contents:

```js
module.exports = {
  ...require("./node_modules/@grafana/toolkit/src/config/prettier.plugin.config.json"),
};
```


## Development mode [todo]
`grafana-toolkit plugin:dev [--watch]`
TODO
- Enable rollup watch on extension sources

