# Grafana Internationalization ESLint Rules

This package also contains custom i18n eslint rules for use within the Grafana codebase and plugins.

## Rules

### `no-untranslated-strings`

Check if strings are marked for translation inside JSX Elements, in certain JSX props, and in certain object properties.

### Options

#### `basePaths`

Allows specifying base paths that should be stripped when generating i18n keys. Defaults to `['src']`.

#### Example

```tsx
// For a file located at public/app/features/search/EmptyState.tsx

// Specifying basePaths:
// {
//   '@grafana/i18n/no-untranslated-strings': ['error', { basePaths: ['public/app/features'] }],
// }

<Trans i18nKey="search.empty-state.no-results-found">No results found</Trans>

// Without basePaths:
// {
//   '@grafana/i18n/no-untranslated-strings': ['error'],
// }

<Trans i18nKey="public.app.features.search.empty-state.no-results-found">No results found</Trans>
```

#### `forceFix`

Allows specifying directories that, if the file is present within, then the rule will automatically fix the errors. This is primarily a workaround to allow for automatic mark up of new violations as the rule evolves.

#### Example:

```ts
{
  '@grafana/i18n/no-untranslated-strings': ['error', { forceFix: ['app/features/some-feature'] }],
}
```

#### `calleesToIgnore`

Allows specifying regexes for methods that should be ignored when checking if object properties are untranslated.

This is particularly useful to exclude references to properties such as `label` inside `css()` calls.

#### Example:

```ts
{
  '@grafana/i18n/no-untranslated-strings': ['error', { calleesToIgnore: ['^css$'] }],
}

// The below would not be reported as an error
const foo = css({
  label: 'test',
});

// The below would still be reported as an error
const bar = {
  label: 'test',
};
```

#### `namespace`

Allows specifying a namespace prefix that will be added to all auto-generated translation keys when using ESLint's auto-fix feature. The namespace is separated from the key with a colon (:).

This is useful for organizing translation keys by feature area or preventing key collisions between different parts of the application.

#### Example:

```tsx
// Configuration:
{
  '@grafana/i18n/no-untranslated-strings': ['error', { namespace: 'dashboard' }],
}

// For a file located at src/features/search/EmptyState.tsx

// Without namespace, auto-fix generates:
<Trans i18nKey="features.search.empty-state.no-results-found">No results found</Trans>

// With namespace: 'dashboard', auto-fix generates:
<Trans i18nKey="dashboard:features.search.empty-state.no-results-found">No results found</Trans>

// For JSX attributes, auto-fix generates:
<div title={t("dashboard:features.search.empty-state.title-no-results", "No results")} />
```

#### JSXText

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

#### JSXAttributes

```tsx
// Bad ❌
<div title="foo bar" />

// Good ✅
<div title={t('some.key.foo-bar', 'foo bar')} />
```

#### Object properties

```tsx
// Bad ❌
const someConfig = {
  label: 'Some label',
};

// Good ✅
const getSomeConfig = () => ({
  label: t('some.key.label', 'Some label'),
});
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
- `subTitle`
- `text`
- `tooltip`
- `message`
- `name`

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
const getSomeConfigThatHasToBeShared = () => [{ foo: t('some.key', 'Some text') }];
const SomeComponent = () => {
  const configs = getSomeConfigThatHasToBeShared();
  return (
    <div>
      {configs.map((cfg) => {
        return <div>{cfg.foo}</div>;
      })}
    </div>
  );
};
```

### `t-plural-defaults`

Enforce the plural-default convention for `t()` calls from `@grafana/i18n`. Whenever the options object contains a `count` key, the call must:

1. Pass an empty string as the positional `defaultValue` (2nd argument).
2. Include both `defaultValue_one` and `defaultValue_other` in the options object.

`i18next` selects the plural variant from `count` + CLDR rules at runtime, and the `i18next-cli` extractor emits the matching `<key>_<suffix>` entries when both forms are declared in source. Splitting one form into the positional default and the other into the options object makes the intent ambiguous and breaks the extractor's contract that source code is the source of truth for every plural form.

#### Examples

```ts
// Bad ❌ — positional default carries the "_other" form implicitly
t('grafana-data.datetime.rangeutils.lastNMinutes', 'Last {{count}} minutes', {
  count,
  defaultValue_one: 'Last {{count}} minute',
});

// Bad ❌ — missing defaultValue_one
t('foo', '', {
  count,
  defaultValue_other: '{{count}} items',
});

// Good ✅ — every plural form lives in the options object
t('grafana-data.datetime.rangeutils.lastNMinutes', '', {
  count,
  defaultValue_one: 'Last {{count}} minute',
  defaultValue_other: 'Last {{count}} minutes',
});

// Good ✅ — no count, so the rule does not apply
t('common.hello', 'Hello {{name}}', { name });
```

This rule is intentionally **not auto-fixable**. A complete fix always needs the engineer to supply the singular form (`defaultValue_one`); a partial auto-fix would risk landing half-migrated call sites. Fix violations by hand and verify the singular/plural copy matches the original intent.

### `trans-plural-defaults`

Enforce the plural-default convention for `<Trans>` components from `@grafana/i18n`. Whenever a `<Trans>` element passes `count` — either as a direct prop or as a key inside its `values` prop — it must declare a `tOptions` prop containing both `defaultValue_one` and `defaultValue_other`.

This is the JSX counterpart to [`t-plural-defaults`](#t-plural-defaults). Same reasoning: `i18next` selects the plural variant from `count` + CLDR rules at runtime, and the `i18next-cli` extractor emits `<key>_<suffix>` entries when both plural defaults are declared in source.

#### Examples

```tsx
// Bad ❌ — count is present, no tOptions at all
<Trans i18nKey="alerting.alert-instance-extension-point.view-route" count={journeys.length}>
  View route
</Trans>

// Bad ❌ — count lives inside values, still no tOptions
<Trans i18nKey="alerting.triage.showing-groups-count" values={{ count: data.length }}>
  Showing {'{{count}}'} groups
</Trans>

// Bad ❌ — tOptions is missing one of the plural forms
<Trans i18nKey="foo" count={n} tOptions={{ defaultValue_one: 'one' }}>x</Trans>

// Good ✅ — direct count prop + both plural defaults
<Trans
  i18nKey="alerting.alert-instance-extension-point.view-route"
  count={journeys.length}
  tOptions={{
    defaultValue_one: 'View route',
    defaultValue_other: 'View routes',
  }}
>
  View route
</Trans>

// Good ✅ — count via values + both plural defaults
<Trans
  i18nKey="alerting.triage.showing-groups-count"
  values={{ count: data.length }}
  tOptions={{
    defaultValue_one: 'Showing {{count}} group',
    defaultValue_other: 'Showing {{count}} groups',
  }}
>
  Showing {'{{count}}'} groups
</Trans>
```

This rule is intentionally **not auto-fixable** for the same reason as `t-plural-defaults`: the singular and plural copy can't be inferred and must be supplied by the engineer.
