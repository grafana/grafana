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

### `no-untranslated-strings`

Check if strings are marked for translation.

```tsx
// Bad ❌
<InlineToast placement="top" referenceElement={buttonRef.current}>
  Copied
</InlineToast>

// Good ✅
<InlineToast placement="top" referenceElement={buttonRef.current}>
  <Trans i18nKey="clipboard-button.inline-toast.success">Copied</Trans>
</InlineToast>

```

#### Passing variables to translations

```tsx
// Bad ❌
const SearchTitle = ({ term }) => <div>Results for {term}</div>;

// Good ✅
const SearchTitle = ({ term }) => <Trans i18nKey="search-page.results-title">Results for {{ term }}</Trans>;

// Good ✅ (if you need to interpolate variables inside nested components)
const SearchTerm = ({ term }) => <Text color="success">{term}</Text>;
const SearchTitle = ({ term }) => (
  <Trans i18nKey="search-page.results-title">
    Results for <SearchTerm term={term} />
  </Trans>
);

// Good ✅ (if you need to interpolate variables and additional translated strings inside nested components)
const SearchTitle = ({ term }) => (
  <Trans i18nKey="search-page.results-title" values={{ myVariable: term }}>
    Results for <Text color="success">{'{{ myVariable }}'} and this translated text is also in green</Text>
  </Trans>
);
```

#### How to translate props or attributes

This rule checks if a string is wrapped up by the `Trans` tag, or if certain props contain untranslated strings.
We ask for such props to be translated with the `t()` function.

The below props are checked for untranslated strings:

- `label`
- `description`
- `placeholder`
- `aria-label`
- `title`
- `text`
- `tooltip`

```tsx
// Bad ❌
<input type="value" placeholder={'Username'} />;

// Good ✅
const placeholder = t('form.username-placeholder', 'Username');
return <input type="value" placeholder={placeholder} />;
```

Check more info about how translations work in Grafana in [Internationalization.md](https://github.com/grafana/grafana/blob/main/contribute/internationalization.md)

### `no-translation-top-level`

Ensure that `t()` translation method is not used at the top level of a file, outside of a component of method.
This is to prevent calling the translation method before it's been instantiated.

This does not cause an error if a file is lazily loaded, but refactors can cause errors, and it can cause problems in tests.
Fix the

```tsx
// Bad ❌
const someTranslatedText = t('some.key', 'Some text');
const SomeComponent = () => {
  return <div title={someTranslatedText} />;
};

// Good ✅
const SomeComponent = () => {
  const someTranslatedText = t('some.key', 'Some text');
  return <div title={someTranslatedText} />;
};

// Bad ❌
const someConfigThatHasToBeShared = [{ foo: t('some.key', 'Some text') }];
const SomeComponent = () => {
  return (
    <div>
      {someConfigThatHasToBeShared.map((cfg) => {
        return <div>{cfg.foo}</div>;
      })}
    </div>
  );
};

// Good ✅
const someConfigThatHasToBeShared = () => [{ foo: t('some.key', 'Some text') }];
const SomeComponent = () => {
  const configs = someConfigThatHasToBeShared();
  return (
    <div>
      {configs.map((cfg) => {
        return <div>{cfg.foo}</div>;
      })}
    </div>
  );
};
```
