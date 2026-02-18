# Grafana ESLint Rules

This package contains custom eslint rules for use within the Grafana codebase only. They're extremely specific to our codebase, and are of little use to anyone else. They're not published to NPM, and are consumed through the Yarn workspace.

## Rules

### `no-aria-label-selectors`

Require aria-label JSX properties to not include selectors from the `@grafana/e2e-selectors` package.

Previously we hijacked the aria-label property to use as E2E selectors as an attempt to "improve accessibility" while making this easier for testing. However, this lead to many elements having poor, verbose, and unnecessary labels.

Now, we prefer using data-testid for E2E selectors.

### `no-border-radius-literal`

Check if border-radius theme tokens are used.

To improve the consistency across Grafana we encourage devs to use tokens instead of custom values. In this case, we want the `borderRadius` to use the appropriate token such as `theme.shape.radius.default`, `theme.shape.radius.pill` or `theme.shape.radius.circle`.

Instead of using `0` to remove a previously set border-radius, use `unset`.

### `no-invalid-css-properties`

Disallow invalid CSS property names in Emotion `css()` calls.

This rule catches typos and invalid CSS properties in Emotion's `css()` function calls, helping prevent bugs where styles are silently ignored by browsers. It uses the [`known-css-properties`](https://www.npmjs.com/package/known-css-properties) package (the same one used by Stylelint) to validate property names against all standard CSS properties.

The rule automatically converts camelCase property names to kebab-case for validation and allows:

- Valid CSS properties (e.g., `paddingLeft`, `backgroundColor`)
- CSS custom properties/variables (e.g., `--my-custom-property`)
- Nested selectors and pseudo-classes (e.g., `&:hover`, `& > div`)
- At-rules (e.g., `@media`, `@supports`)
- HTML tag selectors (e.g., `button`, `span`)

#### Examples

```tsx
// Bad ❌ - Typo in property name
const styles = css({
  addingLeft: 10, // Should be "paddingLeft"
  backgroudColor: 'red', // Should be "backgroundColor"
});

// Good ✅ - Valid CSS properties
const styles = css({
  paddingLeft: 10,
  backgroundColor: 'red',
});

// Good ✅ - CSS custom properties
const styles = css({
  '--my-custom-property': '10px',
});

// Good ✅ - Nested selectors and pseudo-classes
const styles = css({
  '&:hover': {
    backgroundColor: 'blue',
  },
  '& > span': {
    color: 'red',
  },
});

// Good ✅ - Media queries
const styles = css({
  '@media (max-width: 768px)': {
    display: 'none',
  },
});
```

### `no-unreduced-motion`

Avoid direct use of `animation*` or `transition*` properties.

To account for users with motion sensitivities, these should always be wrapped in a [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) media query.

There is a `handleMotion` utility function exposed on the theme that can help with this.

#### Examples

```tsx
// Bad ❌
const getStyles = (theme: GrafanaTheme2) => ({
  loading: css({
    animationName: rotate,
    animationDuration: '2s',
    animationIterationCount: 'infinite',
  }),
});

// Good ✅
const getStyles = (theme: GrafanaTheme2) => ({
  loading: css({
    [theme.transitions.handleMotion('no-preference')]: {
      animationName: rotate,
      animationDuration: '2s',
      animationIterationCount: 'infinite',
    },
    [theme.transitions.handleMotion('reduce')]: {
      animationName: pulse,
      animationDuration: '2s',
      animationIterationCount: 'infinite',
    },
  }),
});

// Good ✅
const getStyles = (theme: GrafanaTheme2) => ({
  loading: css({
    '@media (prefers-reduced-motion: no-preference)': {
      animationName: rotate,
      animationDuration: '2s',
      animationIterationCount: 'infinite',
    },
    '@media (prefers-reduced-motion: reduce)': {
      animationName: pulse,
      animationDuration: '2s',
      animationIterationCount: 'infinite',
    },
  }),
});
```

Note we've switched the potentially sensitive rotating animation to a less intense pulse animation when `prefers-reduced-motion` is set.

Animations that involve only non-moving properties, like opacity, color, and blurs, are unlikely to be problematic. In those cases, you still need to wrap the animation in a `prefers-reduced-motion` media query, but you can use the same animation for both cases:

```tsx
// Bad ❌
const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    transition: theme.transitions.create(['background-color'], {
      duration: theme.transitions.duration.short,
    }),
  }),
});

// Good ✅
const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['background-color'], {
        duration: theme.transitions.duration.short,
      }),
    },
  }),
});

// Good ✅
const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    '@media (prefers-reduced-motion: no-preference), @media (prefers-reduced-motion: reduce)': {
      transition: theme.transitions.create(['background-color'], {
        duration: theme.transitions.duration.short,
      }),
    },
  }),
});
```

### `theme-token-usage`

Used to find all instances of `theme` tokens being used in the codebase and emit the counts as metrics. Should **not** be used as an actual lint rule!

### `consistent-story-titles`

Enforce consistent Storybook titles in `.story.tsx` files.

Storybook titles should not contain more than one `/` for sections (resulting in maximum 2 parts), unless one of the sections is 'Deprecated'. This helps maintain a clean and organized Storybook structure.

#### Examples

```tsx
// Bad ❌
export default { title: 'Components/Forms/Button' };

// Good ✅
export default { title: 'Components/Button' };

// Good ✅ - Deprecated allows any number of sections
export default { title: 'Components/Deprecated/Forms/Button/Extra' };

// Good ✅ - Variable assignment pattern
const storyConfig = { title: 'Components/Button' };
export default storyConfig;

// Bad ❌ - Variable assignment with too many sections
const storyConfig = { title: 'Components/Forms/Button' };
export default storyConfig;
```

### `no-plugin-external-import-paths`

Prevent plugins from importing anything outside their own directory.

This rule enforces strict plugin isolation by preventing plugins from importing anything that reaches outside their own plugin directory. This helps maintain clean plugin boundaries and prevents tight coupling between plugins and other parts of the codebase.

The rule automatically detects the current plugin directory from the file path and blocks any relative imports that would reach outside that directory.

The rule is applied to specific plugins by configuring the `files` pattern in the ESLint configuration, similar to `grafana/decoupled-plugins-overrides`.

#### Examples

```tsx
// Bad ❌ - Importing from sibling plugin
import { getDataLinks } from '../status-history/utils';
import { isTooltipScrollable } from '../timeseries/utils';

// Bad ❌ - Importing from Grafana core
import { something } from '../../../features/dashboard/state';

// Bad ❌ - Importing from outside plugin directory
import { other } from '../some-other-folder/utils';

// Good ✅ - Importing from same plugin
import { someUtil } from './utils';
import { Component } from './Component';
import { helper } from './subfolder/helper';

// Good ✅ - Importing from external packages
import React from 'react';
import { Button } from '@grafana/ui';
```

#### Error Message

When a violation is detected, the rule reports:

```
Import '../status-history/utils' reaches outside the 'histogram' plugin directory. Plugins should only import from external dependencies or relative paths within their own directory.
```
