# Grafana Toolkit

Make sure to run `yarn install` before trying anything!  Otherwise you may see unknown command grafana-toolkit and spend a while tracking that down.

## Internal development
For development use `yarn link`. First, navigate to `packages/grafana-toolkit` and run `yarn link`. Then, in your project use `yarn link @grafana/toolkit` to use linked version.

## Grafana extensions development with grafana-toolkit overview

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

## Prettier [todo]

## Development mode [todo]
TODO
- Enable rollup watch on extension sources

