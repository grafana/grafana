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

#### Using `ThemeContext` directly

```tsx
import { ThemeContext } from '@grafana/ui';

<ThemeContext.Consumer>{theme => <Foo theme={theme} />}</ThemeContext.Consumer>;
```

or

```tsx
import React, { useContext } from 'react';
import { ThemeContext } from '@grafana/ui';

const Foo: React.FunctionComponent<FooProps> = () => {
  const theme = useContext(ThemeContext);

  // Your component has access to the theme variables now
}
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

  it('renders correctyl', () => {
    const wrapper = mount(<MyComponent />)
    expect(wrapper).toMatchSnapshot();
  });
});
```

### Using themes in [Storybook](https://storybook.js.org/)

All stories are wrapped with `ThemeContext.Provider` using a global decorator. To render a `Themeable` component that isn't wrapped by a `withTheme` HOC, either create a new component in your story, or use the `renderComponentWithTheme` helper.

#### Create a new component:

```tsx
// Foo.story.tsx
const FooWithTheme = withTheme(Foo);

FooStories.add('Story' () => {
  return <FooWithTheme />
});
```

#### Use `renderComponentWithTheme` helper:

```tsx
// Bar.story.tsx

BarStories.add('Story' () => {
  return renderComponentWithTheme(Bar, /* pass props here */)
});
```

### Using themes in Angular code

There should be very few cases where a theme would be used in an Angular context. For this purpose, there is a function available that retrieves the current theme:

```ts
import { getCurrentTheme } from app/core/utils/ConfigProvider
```

Angular components should be migrated to React, or if that's not possible at the moment, styled using Sass.

## FAQ

This section provides insight into frequently-asked questions.

### How can I modify Sass variable files?

> For the following to apply you need to run `yarn dev` task.

`[_variables|_variables.dark|_variables.light].generated.scss` files are the ones that are referenced in the main Sass files for Sass variables to be available. **These files are automatically generated and should never be modified by hand!**

#### If you need to modify a *Sass variable value* you need to modify the corresponding Typescript file that is the source of the variables:
- `_variables.generated.scss` - modify `grafana-ui/src/themes/default.ts`
- `_variables.light.generated.scss` - modify `grafana-ui/src/themes/light.ts`
- `_variables.dark.generated.scss` - modify `grafana-ui/src/themes/dark.ts`

#### If you need to *add new variable* to Sass variables you need to modify corresponding template file:
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
