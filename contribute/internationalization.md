# Internationalization

Grafana uses the [i18next](https://www.i18next.com/) framework for managing translating phrases in the Grafana frontend.

## tl;dr

**Please note:** We do not currently accept contributions for translations. Please do not submit pull requests translating grafana.json files - they will be rejected. We do accept contributions to mark up phrases for translation.

- Use `<Trans i18nKey="search-results.panel-link">Go to {{ pageTitle }}</Trans>` in code to add a translatable phrase
- Translations are stored in JSON files in `public/locales/{locale}/grafana.json`
- If a particular phrase is not available in the a language then it will fall back to English
- To update phrases in English, edit the default phrase in the component's source and then run `yarn i18n:extract`.
- The single source of truth for en-US (fallback language) is in grafana/grafana, the single source of truth for any translated language is Crowdin
- To update phrases in any translated language, edit the phrase in Crowdin. Do not edit the `{locale}/grafana.json`

## How to add a new translation phrase

### JSX

1. For JSX children, use the `<Trans />` component from `app/core/internationalization` with the `i18nKey`, ensuring it conforms to the guidelines below, with the default english translation. e.g.

```jsx
import { Trans } from 'app/core/internationalization';

const SearchTitle = ({ term }) => (
  <Trans i18nKey="search-page.results-title">
    Results for <em>{{ term }}</em>
  </Trans>
);
```

Prefer using `<Trans />` for JSX children, and `t()` for props and other javascript usage.

When translating in grafana-ui, use a relative path to import `<Trans />` and `t()` from `src/utils/i18n`.

Note that our tooling must be able to statically analyse the code to extract the phrase, so the `i18nKey` can not be dynamic. e.g. the following will not work:

```jsx
const ErrorMessage = ({ id, message }) => <Trans i18nKey={`errors.${id}`}>There was an error: {{ message }}</Trans>;
```

2. Upon reload, the default English phrase will appear on the page.

3. Before submitting your PR, run the `yarn i18n:extract` command to extract the messages you added into the `public/locales/en-US/grafana.json` file and make them available for translation.
   **Note:** All other languages will receive their translations when they are ready to be downloaded from Crowdin.

### Plain JS usage

Sometimes you may need to translate a string cannot be represented in JSX, such as `placeholder` props. Use the `t` macro for this.

```jsx
import { t } from "app/core/internationalization"

const placeholder = t('form.username-placeholder','Username');

return <input type="value" placeholder={placeholder}>
```

Interpolating phrases is a bit more verbose. Make sure the placeholders in the string match the values passed in the object - there's no type safety here!

```jsx
const placeholder = t('page.greeting', 'Hello {{ username }}', { username });
```

While the `t` function can technically be used outside of React functions (e.g, in actions/reducers), aim to keep all UI phrases within the React UI functions.

## How to add a new language

1. Add a new locale in Crowdin
   1. Grafana OSS Crowdin project
   2. "dot dot dot" menu in top right
   3. Target languages, and add the language
   4. If Crowdin's locale code is different from our IETF language tag, add a custom mapping in Project Settings -> Language mapping
2. Sync the new (empty) language to the repo
   1. In Grafana's Github Actions, go to [Crowdin Download Action](https://github.com/grafana/grafana/actions/workflows/i18n-crowdin-download.yml)
   2. Select 'Run workflow', from main
   3. The workflow will create a PR with the new language files, which can be reviewed and merged
3. Update `public/app/core/internationalization/constants.ts`
   1. Add a new constant for the new language
   2. Add the new constant to the `LOCALES` array
   3. Create a PR with the changes and merge when you are ready to release the new language (probably wait until we have translations for it)

## How translations work in Grafana

Grafana uses the [i18next](https://www.i18next.com/) framework for managing translating phrases in the Grafana frontend. It:

- Marks up phrases within our code for extraction
- Extracts phrases into the default messages catalogue for translating in external systems
- Manages the user's locale and putting the translated phrases in the UI

Grafana will load the message catalogue JSON before the initial render.

### Phrase ID naming convention

We set explicit IDs for phrases to make it easier to identify phrases out of context, and to track where they're used. IDs follow a naming scheme that includes _where_ the phrase is used. The exception is the rare case of single reoccuring words like "Cancel", but default to using a feature/phrase specific phrase.

Message IDs are made of _up to_ three segments in the format `feature.area.phrase`. For example:

- `dashboard.header.refresh-label`
- `explore.toolbar.share-tooltip`

For components used all over the site, use just two segments:

- `footer.update`
- `navigation.home`

### I18next context

We rely on a global i18next singleton (that lives inside the i18next) for storing the i18next config/context.

## Examples

See [i18next](https://www.i18next.com/) and [react-i18next](https://react.i18next.com/) documentation for more details.

### Basic usage

For fixed phrases:

```jsx
import { Trans } from 'app/core/internationalization';

<Trans i18nKey="page.greeting">Hello user!</Trans>;
```

To interpolate variables, include it as an object child. It's weird syntax, but Trans will do it's magic to make it work:

```jsx
import { Trans } from 'app/core/internationalization';

<Trans i18nKey="page.greeting">Hello {{ name: user.name }}!</Trans>;

const userName = user.name;
<Trans i18nKey="page.greeting">Hello {{ userName }}!</Trans>;
```

Variables must be strings (or, must support calling `.toString()`, which we almost never want).

```jsx
import { Trans } from 'app/core/internationalization';

// This will not work
const userName = <strong>user.name</strong>;
<Trans i18nKey="page.greeting">Hello {{ userName }}!</Trans>;

// Instead, put the JSX inside the phrase directly
const userName = user.name;
<Trans i18nKey="page.greeting">
  Hello <strong>{{ userName }}</strong>!
</Trans>;
```

### React components and HTML tags

Both HTML tags and React components can be included in a phase. The Trans function will handle interpolating it's children properly

```js
import { Trans } from "app/core/internationalization"

<Trans i18nKey="page.explainer">
  Click <button>here</button> to <a href="https://grafana.com">learn more.</a>
</Trans>

// ↓ is in the grafana.json file like ↓
{
  "page": {
    "explainer": "Click <0>here</0> to <1>learn more</1>"
  }
}
```

### Plurals

Plurals require special handling to make sure they can be translating according to the rules of each locale (which may be more complex that you think!). Use either the `<Trans />` component or the `t` function, with the `count` prop to provide a singular form.

```js
import { Trans } from 'app/core/internationalization';

<Trans i18nKey="inbox.heading" count={messages.length}>
  You got {{ count: messages.length }} message
</Trans>;
```

```js
import { t } from 'app/core/internationalization';

const translatedString = t('inbox.heading', 'You got {{count}} message', { count: messages.length });
```

Once extracted with `yarn i18n:extract` you will need to manually edit the [English grafana.json message catalogue](../public/locales/en-US/grafana.json) to correct the plural forms. See the [react-i18next docs](https://react.i18next.com/latest/trans-component#plural) for more details.

```json
{
  "inbox": {
    "heading_one": "You got {{count}} message",
    "heading_other": "You got {{count}} messages"
  }
}
```

## Feedback

**Please note:** This is only for proofreaders with permissions to Grafana OSS project on Crowdin.

To provide feedback on translations, sign into Crowdin and follow these steps:

1. Open the Grafana OSS project in Crowdin.
2. In the left-hand menu, click on the 'Dashboard' menu item.
3. A list of available languages appears under the 'Translations' section. Click on the one you want to comment on.
4. There is a table with the file structure in it:
   <br>
   `grafana/main > public > locales > 'language denomination' > grafana.json`
   <br>
   Click on the `grafana.json` file.
5. In the left-hand section, click on the 'Search in file' input and search for the string that you want to comment on. You can search in English, as it is the default language, or in the language the string is translated to.
6. Once you have found the string, on the right hand side there is a 'Comments' section where you can send the feedback about the translation. Tag @Translated to be sure the team of linguists gets notified.

## Documentation

[Grafana's documentation](https://grafana.com/docs/grafana/latest/) is not yet open for translation and should be authored in American English only.
