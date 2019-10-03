# Styling Grafana

## Emotion

[Emotion](https://emotion.sh/docs/introduction) is our default-to-be approach to styling React components. It provides a way for styles to be a consequence of properties and state of a component.

### Usage

#### Basic styling

For styling components use Emotion's `css` function

```tsx
import { css }  from 'emotion';


const ComponentA = () => {
  return (
    <div className={css`background: red;`}>
      As red as you can ge
    </div>
  );
}
```

#### Styling complex components

In more complex cases, especially when you need to style multiple DOM elements in one component or when your styles that depend on properties and/or state, you should create a helper function that returns an object with desired stylesheet. Let's say you need to style a component that has different background depending on the theme:

```tsx
import { css, cx }  from 'emotion';
import { GrafanaTheme, useTheme, selectThemeVariant } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme) => {
  const backgroundColor = selectThemeVariant({ light: theme.colors.red, dark: theme.colors.blue }, theme.type);

  return {
    wrapper: css`
      background: ${backgroundColor};
    `,
    icon: css`font-size:${theme.typography.size.sm}`;
  };
}

const ComponentA = () => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      As red as you can ge
      <i className={styles.icon} /\>
    </div>
  );
}
```

For more information about themes at Grafana please see [themes guide](./themes.md)

#### Composing class names

For class composition use Emotion's `cx` function

```tsx
import { css, cx }  from 'emotion';


interface Props {
  className?: string;
}

const ComponentA: React.FC<Props> = ({ className }) => {
  const finalClassName = cx(
    className,
    css`background: red`,
  )

  return (
    <div className={finalClassName}>
      As red as you can ge
    </div>
  );
}
```
