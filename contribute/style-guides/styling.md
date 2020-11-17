# Styling Grafana

[Emotion](https://emotion.sh/docs/introduction) is our default-to-be approach to styling React components. It provides a way for styles to be a consequence of properties and state of a component.

## Usage

### Basic styling

For styling components, use [Emotion's `css` function](https://emotion.sh/docs/emotion#css).

```tsx
import React from 'react';
import { css } from 'emotion';

const ComponentA = () => (
  <div
    className={css`
      background: red;
    `}
  >
    As red as you can get
  </div>
);
```

### Styling with theme

To access the theme in your styles, use the `useStyles` hook. It provides basic memoization and access to the theme object.

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

### Styling complex components

In more complex cases, especially when you need to style multiple DOM elements in one component, or when using styles that depend on properties and/or state, you should create a helper function that returns an object of styles. This function should also be wrapped in the `stylesFactory` helper function, which will provide basic memoization.

Let's say you need to style a component that has a different background depending on the theme:

```tsx
import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant, stylesFactory, useTheme } from '@grafana/ui';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const backgroundColor = selectThemeVariant({ light: theme.colors.red, dark: theme.colors.blue }, theme.type);

  return {
    wrapper: css`
      background: ${backgroundColor};
    `,
    icon: css`
      font-size: ${theme.typography.size.sm};
    `,
  };
});

const ComponentA = () => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      As red as you can get
      <i className={styles.icon} />
    </div>
  );
};
```

For more information about themes at Grafana please see the [themes guide](./themes.md).

### Composing class names

For class composition, use [Emotion's `cx` function](https://emotion.sh/docs/emotion#cx).

```tsx
import React from 'react';
import { css, cx } from 'emotion';

interface Props {
  className?: string;
}

const ComponentA: React.FC<Props> = ({ className }) => {
  const finalClassName = cx(
    className,
    css`
      background: red;
    `
  );

  return <div className={finalClassName}>As red as you can ge</div>;
};
```
