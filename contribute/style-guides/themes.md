# Theming Grafana

## Overview

**Themes are implemented in Typescript.** That's because our goal is to share variables between Grafana TypeScript and [Sass](https://sass-lang.com/) code. Theme definitions are located in the following files:

- [packages/grafana-ui/src/themes/dark.ts](../../packages/grafana-ui/src/themes/dark.ts)
- [packages/grafana-ui/src/themes/default.ts](../../packages/grafana-ui/src/themes/default.ts)
- [packages/grafana-ui/src/themes/light.ts](../../packages/grafana-ui/src/themes/light.ts)

The `default.ts` file holds common variables like typography and spacing definitions, while `[light|dark].ts` primarily specify colors used in themes.

## Usage

This section provides usage guidelines.

### Using themes in React components

Here's how to use Grafana themes in React components.

#### useStyles hook

`useStyles` memoizes the function and provides access to the theme.

```tsx
import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css } from 'emotion';

const getComponentStyles = (theme: GrafanaTheme) => css`
  padding: ${theme.spacing.md};
`;

const Foo: FC<FooProps> = () => {
  const styles = useStyles(getComponentsStyles);

  // Use styles with className
};
```

#### Get the theme object

```tsx
import React, { FC } from 'react';
import { useTheme } from '@grafana/ui';

const Foo: FC<FooProps> = () => {
  const theme = useTheme();

  // Your component has access to the theme variables now
};
```

#### Using `ThemeContext` directly

```tsx
import { ThemeContext } from '@grafana/ui';

<ThemeContext.Consumer>{theme => <Foo theme={theme} />}</ThemeContext.Consumer>;
```

#### Using `withTheme` higher-order component (HOC)

With this method your component will be automatically wrapped in `ThemeContext.Consumer` and provided with current theme via `theme` prop. Components used with `withTheme` must implement the `Themeable` interface.

```ts
import  { ThemeContext, Themeable } from '@grafana/ui';

interface FooProps extends Themeable {}

const Foo: React.FunctionComponent<FooProps> = () => ...

export default withTheme(Foo);
```

### Test components that use `ThemeContext`

When implementing snapshot tests for components that use the `withTheme` HOC, the snapshot will contain the entire theme object. Any change to the theme renders the snapshot outdated.

To make your snapshot theme independent, use the `mockThemeContext` helper function:

```tsx
import { mockThemeContext } from '@grafana/ui';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  let restoreThemeContext;

  beforeAll(() => {
    // Create ThemeContext mock before any snapshot test is executed
    restoreThemeContext = mockThemeContext({ type: GrafanaThemeType.Dark });
  });

  afterAll(() => {
    // Make sure the theme is restored after snapshot tests are performed
    restoreThemeContext();
  });


  it('renders correctly', () => {
    const wrapper = mount(<MyComponent />)
    expect(wrapper).toMatchSnapshot();
  });
});
```

## FAQ

This section provides insight into frequently-asked questions.

### How can I modify Sass variable files?

**If possible, migrate styles to Emotion**

> For the following to apply you need to run `yarn dev` task.

`[_variables|_variables.dark|_variables.light].generated.scss` files are the ones that are referenced in the main Sass files for Sass variables to be available. **These files are automatically generated and should never be modified by hand!**

#### If you need to modify a _Sass variable value_ you need to modify the corresponding Typescript file that is the source of the variables:

- `_variables.generated.scss` - modify `grafana-ui/src/themes/default.ts`
- `_variables.light.generated.scss` - modify `grafana-ui/src/themes/light.ts`
- `_variables.dark.generated.scss` - modify `grafana-ui/src/themes/dark.ts`

#### If you need to _add new variable_ to Sass variables you need to modify corresponding template file:

- `_variables.generated.scss` - modify `grafana-ui/src/themes/_variables.scss.tmpl.ts`
- `_variables.light.generated.scss` - modify `grafana-ui/src/themes/_variables.light.scss.tmpl.ts`
- `_variables.dark.generated.scss` - modify `grafana-ui/src/themes/_variables.dark.scss.tmpl.ts`

## Limitations

This section describes limitations with Grafana's theming system.

### You must ensure `ThemeContext` provider is available in a React tree

By default all react2angular directives have `ThemeContext.Provider` ensured. But, there are cases where we create another React tree via `ReactDOM.render`. This happens in the case of graph legend rendering and the `ReactContainer` directive. In such cases theme consumption will fail. To make sure theme context is available in such cases, you need to wrap your rendered component with ThemeContext.Provider using the `provideTheme` function:

```ts
// graph.ts
import { provideTheme } from 'app/core/utils/ConfigProvider';

// Create component with ThemeContext.Provider first.
// Otherwise React will create new components every time it renders!
const LegendWithThemeProvider = provideTheme(Legend);

const legendReactElem = React.createElement(LegendWithThemeProvider, legendProps);
ReactDOM.render(legendReactElem, this.legendElem, () => this.renderPanel());
```

`provideTheme` makes current theme available via ThemeContext by checking if user has `lightTheme` set in her boot data.
