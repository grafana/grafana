# Styling Grafana

[Emotion](https://emotion.sh/docs/introduction) is our default-to-be approach to styling React components. It provides a way for styles to be a consequence of properties and state of a component.

## Usage

For styling components, use [Emotion's `css` function](https://emotion.sh/docs/emotion#css).

### Basic styling

To access the theme in your styles, use the `useStyles` hook. It provides basic memoization and access to the theme object.

> Please remember to put `getStyles` function at the end of the file!

```tsx
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

const Foo = (props: FooProps) => {
  const styles = useStyles2(getStyles);

  // Use styles with classNames
  return <div className={styles}>...</div>;
};

const getStyles = (theme: GrafanaTheme2) =>
  css({
    padding: theme.spacing(1, 2), // will result in 8px 16px padding
  });
```

### Styling complex components

In more complex cases, especially when you need to style multiple DOM elements in one component, or when using styles that depend on properties and/or state you
can have your getStyles function return an object with many class names and use [Emotion's `cx` function](https://emotion.sh/docs/@emotion/css#cx) to compose them.

Let's say you need to style a component that has a different background depending on the `isActive` property :

```tsx
import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface ComponentAProps {
  isActive: boolean;
}

const ComponentA = ({ isActive }: ComponentAProps) => {
  const theme = useTheme();
  const styles = useStyles2(theme);

  return (
    <div className={cx(styles.wrapper, isActive && styles.active)}>
      As red as you can get
      <i className={styles.icon} />
    </div>
  );
};

// Mind, that you can pass multiple arguments, theme included
const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      background: theme.colors.background.secondary;
    }),
    active: css({
      background: theme.colors.primary.main,
      text: theme.colors.primary.contrastText,
    },
    icon: css({
      fontSize: theme.typography.bodySmall.fontSize;
    })
  };
};
```

For more information about themes at Grafana please see the [themes guide](./themes.md).
