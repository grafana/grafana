# Grafana Internationalization ESLint Rules

This package also contains custom i18n eslint rules for use within the Grafana codebase and plugins.

## Rules

### `no-untranslated-strings`

Check if strings are marked for translation inside JSX Elements, in certain JSX props, and in certain object properties.

### Options

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
