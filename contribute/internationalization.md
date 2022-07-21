# Internationalization

Grafana uses the [LinguiJS](https://github.com/lingui/js-lingui) framework for managing translating phrases in the Grafana frontend.

## tl;dr

- Use `<Trans id="search-results.panel-link">Go to {panel.title}</Trans>` in code to add a translatable phrase
- Translations are stored in .po files in `public/locales/{locale}/messages.po`
- If a particular phrase is not available in the a language then it will fall back to English

## How to add a new translation phrase

1. Use one of `@lingui/macro`'s React components with the `id`, ensuring it conforms to the guidelines below, with the default english translation. e.g.

```jsx
import { Trans } from @lingui/macro

const SearchTitle = ({term}) => (
  <Trans id="search-page.results-title">
    Results for {term}
  </Trans>
);
```

Prefer using the JSX components (compared to the plain javascript functions, see below) where possible for phrases. Many props can (and probably should) be changed to accept the `React.ReactNode` instead of `string` for phrases put into the DOM.

Note that Lingui must be able to statically analyse the code to extract the phrase, so the `id` can not be dynamic. e.g. the following will not work:

```jsx
const ErrorMessage = ({ id, message }) => <Trans id={`errors.${id}`}>There was an error: {message}</Trans>;
```

2. Upon reload, the default English phrase will appear on the page.

3. Before submitting your PR, run the `yarn i18n:extract` command to extract the messages you added into the `messages.po` file and make them available for translation.

## How translations work in Grafana

Grafana uses the [LinguiJS](https://github.com/lingui/js-lingui) framework for managing translating phrases in the Grafana frontend. It:

- Marks up phrases within our code for extraction
- Extracts phrases into messages catalogues for translating in external systems
- "Compiles" the catalogues to a format that can be used in the website
- Manages the user's locale and putting the translated phrases in the UI

### Phrase ID naming convention

We set explicit IDs for phrases to make it easier to identify phrases out of context, and to track where they're used. IDs follow a naming scheme that includes _where_ the phrase is used. The exception is the rare case of single reoccuring words like "Cancel", but default to using a feature/phrase specific phrase.

Message IDs are made of _up to_ three segments in the format `feature.area.phrase`. For example:

- `dashboard.header.refresh-label`
- `explore.toolbar.share-tooltip`

For components used all over the site, use just two segments:

- `footer.update`
- `navigation.home`

### Top-level provider

In [AppWrapper.tsx](/public/app/AppWrapper.tsx) the app is wrapped with `I18nProvider` from `public/app/core/internationalization/index.tsx` where the Lingui instance is created with the user's preferred locale. This sets the appropriate context and allows any component from `@lingui/macro` to use the translations for the user's preferred locale.

### Message format

Lingui uses the [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/) for the phrases in the .po catalogues. ICU has special syntax especially for describing plurals across multiple languages. For more details see the [Lingui docs](https://lingui.js.org/ref/message-format.html).

### Plain JS usage

See [Lingui Docs](https://lingui.js.org/ref/macro.html#t) for more details.

Sometimes you may need to translate a string cannot be represented in JSX, such as `placeholder` props. Use the `t` macro for this.

```jsx
import { t } from "@lingui/macro"

const placeholder = t({
   id: 'form.username-placeholder',
   message: `Username`
});

return <input type="value" placeholder={placeholder}>
```

While the `t` macro can technically be used outside of React functions (e.g, in actions/reducers), aim to keep all UI phrases within the React UI functions.

## Examples

See the [Lingui docs](https://lingui.js.org/ref/macro.html#usage) for more details.

### Basic usage

For fixed phrases:

```jsx
import { Trans } from '@lingui/macro';

<Trans id="page.greeting">Hello user!</Trans>;
```

You can include variables, just like regular JSX. Prefer using "simple" variables to make the extracted phrase easier to read for translators

```jsx
import { Trans } from '@lingui/macro';

// Bad - translators will see: Hello {0}
<Trans id="page.greeting">Hello {user.name}!</Trans>;

// Good - translators will see: Hello {userName}
const userName = user.name;
<Trans id="page.greeting">Hello {userName}!</Trans>;
```

Variables must be strings (or, must support calling `.toString()`, which we almost never want).

```jsx
import { Trans } from '@lingui/macro';

// This will not work
const userName = <strong>user.name</strong>;
<Trans id="page.greeting">Hello {userName}!</Trans>;

// Instead, put the JSX inside the phrase directly
const userName = user.name;
<Trans id="page.greeting">
  Hello <strong>{userName}</strong>!
</Trans>;
```

### React components and HTML tags

Both HTML tags and React components can be included in a phase. The Lingui macro will replace them with placeholder tags for the translators

```js
import { Trans } from "@lingui/macro"

const randomVariable = "variable"

<Trans id="page.explainer">
  Click <button>here</button> to <a href="https://grafana.com">learn more.</a>
</Trans>

// ↓ is transformed by macros into ↓
<Trans
  id="page.explainer"
  defaults="Click <0>here</0> to <1>learn more</1>"
  components={[
    <button />,
    <Text />
  ]}
/>

// ↓ is in the messages.po file like ↓
msgid "page.explainer"
msgstr "Click <0>here</0> to <1>learn more</1>"
```

### Plurals

See the [Lingui docs](https://lingui.js.org/ref/macro.html#id1) for more details.

Plurals require special handling to make sure they can be translating according to the rules of each locale (which may be more complex that you think!). Use the `<Plural />` component and specify the plural forms for the default language (English). The message will be extracted into a form where translators can extend it with rules for other locales.

```js
import { Plural } from "@lingui/macro"

<Plural
  id="sharing.shared-with"
  value={sharedCount}
  none="Not shared with anyone"
  one="Shared with one person"
  other="Shared with # people"
/>

// ↓ is transformed by macros into ↓

<Trans
  id="example.plurals"
  values={{ sharedCount }}
  defaults="{sharedCount, plural, none {Not shared with anyone}, one {Shared with one person}, other {Shared with # people}"
/>

// sharedCount = 0 -> Not shared with anyone
// sharedCount = 1 -> Shared with one person
// sharedCount = 3 -> Shared with # people
```

### Date and time

[Lingui has functions](https://lingui.js.org/ref/core.html#I18n.date) to format dates and times according to the convention to the user's preferred locale, based on the browser [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) API. However, as displaying dates and times is fundamental to Grafana, guidelines have not been established for this yet.

## Documentation

[Grafana's documentation](https://grafana.com/docs/grafana/latest/) is not yet open for translation and should be authored in American English only.
