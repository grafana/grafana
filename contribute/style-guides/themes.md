# Work with Grafana themes

## Overview

Themes in Grafana are implemented in TypeScript. We chose the TypeScript language in part because it shares variables between Grafana TypeScript and [Sass](https://sass-lang.com/) code.

Theme definitions are located in the following files:

- [packages/grafana-data/src/themes/createTheme.ts](../../packages/grafana-data/src/themes/createTheme.ts)
- [packages/grafana-data/src/themes/createColors.ts](../../packages/grafana-data/src/themes/createColors.ts)

## Usage

This section provides usage guidelines for themes.

### Use themes in React components

The following section describes how to use Grafana themes in React components.

#### The useStyles2 hook

The `useStyles2` hook memoizes the function and provides access to the theme.

```tsx
import { FC } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

function Foo(props: FooProps) {
  const styles = useStyles2(getStyles);
  // Use styles with className
}

const getStyles = (theme: GrafanaTheme2) =>
  css({
    padding: theme.spacing(1, 2),
  });
```

#### Get the theme object

Use code similar to the following to give your component access to the theme variables:

```tsx
import { FC } from 'react';
import { useTheme2 } from '@grafana/ui';

const Foo: FC<FooProps> = () => {
  const theme = useTheme2();

  // Your component has access to the theme variables now
};
```

## Select a variable

This section explains how to select the correct variables in your theme.

### The rich color object and the state colors

The `theme.colors` object has six rich color objects:

- `primary`
- `secondary`
- `info`
- `success`
- `warning`
- `error`

All these objects use the same secondary colors which are associated with different use cases.

| Property     | When to use                                                |
| ------------ | ---------------------------------------------------------- |
| main         | For backgrounds                                            |
| shade        | For hover highlight                                        |
| text         | For text color                                             |
| border       | For borders, currently always the same as text color       |
| contrastText | Text color to use for text placed on top of the main color |

Example use cases:

- Want a red background? Use `theme.colors.error.main`.
- Want green text? Use `theme.colors.success.text`.
- Want text to be visible when placed inside a background that uses `theme.colors.error.main`? Use `theme.colors.error.contrastText`.

### Text colors

| Property                      | When to use                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| theme.colors.text.primary     | The default text color                                                         |
| theme.colors.text.secondary   | Text color for things that should be a bit less prominent                      |
| theme.colors.text.disabled    | Text color for disabled or faint things                                        |
| theme.colors.text.link        | Text link color                                                                |
| theme.colors.text.maxContrast | Maximum contrast (absolute white in dark theme, absolute black in white theme) |

### Background colors

| Property                          | When to use                                                                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| theme.colors.background.canvas    | Dashboard background. A background surface for panels and panes that use primary background                                                                                                  |
| theme.colors.background.primary   | The default content background for content panes and panels                                                                                                                                  |
| theme.colors.background.secondary | For cards and other surfaces that need to stand out when placed on top of the primary background                                                                                             |
| theme.colors.background.elevated  | For popovers and menu backgrounds. This is the same color as primary in most light themes but in dark themes it has a brighter shade to help give it contrast against the primary background |

### Borders

| Property                   | When to use                                                  |
| -------------------------- | ------------------------------------------------------------ |
| theme.colors.border.weak   | Primary border for panels and panes and other subtle borders |
| theme.colors.border.medium | For stronger borders like inputs                             |
| theme.colors.border.strong | For even stronger border like hover highlighted border       |

### Actions

| Property                     | When to use                                           |
| ---------------------------- | ----------------------------------------------------- |
| theme.colors.action.hover    | Background color for hover on card, menu or list item |
| theme.colors.action.focus    | Background color for focused card, menu or list item  |
| theme.colors.action.selected | Background color for selected card, menu or list item |

### Paddings and margins

| Example                     | Result            |
| --------------------------- | ----------------- |
| theme.spacing(1)            | 8px               |
| theme.spacing(1, 2)         | 8px 16px          |
| theme.spacing(1, 2, 0.5, 4) | 8px 16px 4px 32px |

### Border radius

| Example                     | Result |
| --------------------------- | ------ |
| theme.shape.borderRadius(1) | 2px    |
| theme.shape.borderRadius(2) | 4px    |

### Typography

To customize font family, font sizes, and line heights, use the variables under `theme.typography`.

#### Set the context directly

Use `ThemeContext` like this:

```tsx
import { ThemeContext } from '@grafana/data';

<ThemeContext.Consumer>{(theme) => <Foo theme={theme} />}</ThemeContext.Consumer>;
```

#### Use `withTheme` higher-order component

With this method your component will be automatically wrapped in `ThemeContext.Consumer` and provided with current theme via the `theme` prop. Components used with `withTheme` must implement the `Themeable` interface.

```ts
import  { ThemeContext, Themeable } from '@grafana/ui';

interface FooProps extends Themeable2 {}

const Foo: React.FunctionComponent<FooProps> = () => ...

export default withTheme2(Foo);
```

### Use a theme in tests

If you need to pass a theme object to a function that you are testing, then import `createTheme` and call it without any arguments. For example:

```tsx
import { createTheme } from '@grafana/data';

describe('MyComponent', () => {
  it('should work', () => {
    result = functionThatNeedsTheme(createTheme());
    expect(result).toBe(true);
  });
});
```

### Modify Sass variables

If you need to modify the Sass variable files, we recommend that you migrate the styles to [Emotion](https://emotion.sh/docs/introduction).

For the following variables to apply, you need to run this `yarn dev` task:

- `[_variables|_variables.dark|_variables.light].generated.scss`: These files must be referenced in the main Sass files for Sass variables to be available.

If you need to modify the Sass variable files, be sure to update the files that end with `.tmpl.ts` and not the `.generated.scss` files.

> **Important:** These variable files are automatically generated and should never be modified by hand.
