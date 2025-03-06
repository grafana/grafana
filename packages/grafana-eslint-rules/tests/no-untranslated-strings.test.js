import { RuleTester } from 'eslint';

import noUntranslatedStrings from '../rules/no-untranslated-strings.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

const transError = 'No untranslated strings. Wrap text with <Trans />';
const propsError = 'No untranslated strings in text props. Wrap text with <Trans /> or use t()';

const filename = 'public/app/features/some-feature/SomeFile.tsx';

const ruleTester = new RuleTester();

ruleTester.run('eslint no-untranslated-strings', noUntranslatedStrings, {
  valid: [
    {
      code: `<div><Trans>Translated text</Trans></div>`,
    },
    {
      code: `<div>{t('translated.key', 'Translated text')}</div>`,
    },
    {
      code: `<div aria-label={t('aria.label', 'Accessible label')} />`,
    },
    {
      code: `<Button><Trans>Button text</Trans></Button>`,
    },
    {
      code: `<div>{variable}</div>`,
    },
  ],
  invalid: [
    /**
     * FIXABLE CASES
     */
    // Basic happy path case:
    // untranslated text, in a component, in a file location where we can extract a prefix,
    // and it can be fixed
    {
      code: `
const Foo = () => <div>Untranslated text</div>`,
      filename,
      errors: [{ message: transError }],
      output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><Trans i18nKey="some-feature.foo.untranslated-text">Untranslated text</Trans></div>`,
    },

    // Fixes medium length strings
    {
      code: `
const Foo = () => <div>This is a longer string that we will translate</div>`,
      filename,
      errors: [{ message: transError }],
      output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><Trans i18nKey="some-feature.foo.longer-string-translate">This is a longer string that we will translate</Trans></div>`,
    },

    // Fixes short strings
    {
      code: `
const Foo = () => <div>lots of sho rt word s to be filt ered</div>`,
      filename,
      errors: [{ message: transError }],
      output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><Trans i18nKey="some-feature.foo.lots-of-sho-rt-word-s">lots of sho rt word s to be filt ered</Trans></div>`,
    },

    // Fixes strings in JSX in props
    {
      code: `
const Foo = () => <div><TestingComponent someProp={<>Test</>} /></div>`,
      filename,
      errors: [{ message: transError }],
      output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><TestingComponent someProp={<><Trans i18nKey="some-feature.foo.test">Test</Trans></>} /></div>`,
    },

    // Fixes and uses ID from attribute if exists
    {
      code: `
import { t } from 'app/core/internationalization';
const Foo = () => <div id="someid" title="foo"/>`,
      filename,
      errors: [{ message: propsError }],
      output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div id="someid" title={t("some-feature.foo.someid-title-foo", "foo")}/>`,
    },

    // Fixes correctly when import already exists (<Trans>)
    {
      code: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div>Untranslated text</div>`,
      filename,
      errors: [{ message: transError }],
      output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><Trans i18nKey="some-feature.foo.untranslated-text">Untranslated text</Trans></div>`,
    },

    // Fixes correctly when import already exists (t())
    {
      code: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title="foo" />`,
      filename,
      errors: [{ message: propsError }],
      output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", "foo")} />`,
    },

    // Fixes correctly when import already exists but it needs to add t() method
    {
      code: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div title="foo" />`,
      filename,
      errors: [{ message: propsError }],
      output: `
import { Trans, t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", "foo")} />`,
    },

    // Fixes correctly with a Class component
    {
      code: `
class Foo extends React.Component {
  render() {
    return <div>untranslated text</div>;
  }
}`,
      filename,
      errors: [{ message: transError }],
      output: `
import { Trans } from 'app/core/internationalization';
class Foo extends React.Component {
  render() {
    return <div><Trans i18nKey="some-feature.foo.untranslated-text">untranslated text</Trans></div>;
  }
}`,
    },

    // Fixes basic prop case
    {
      code: `
const Foo = () => <div title="foo" />`,
      filename,
      errors: [{ message: propsError }],
      output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", "foo")} />`,
    },

    // Fixes prop case with double quotes in value
    {
      code: `
const Foo = () => <div title='"foo"' />`,
      filename,
      errors: [{ message: propsError }],
      output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", '"foo"')} />`,
    },

    // Fixes case with nested functions/components
    {
      code: `
import { Trans } from 'app/core/internationalization';
const Foo = () => {
  const getSomething = () => {
    return <div>foo</div>;
  }

  return <div>{getSomething()}</div>;
}
`,
      filename,
      errors: [{ message: transError }],
      output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => {
  const getSomething = () => {
    return <div><Trans i18nKey="some-feature.foo.get-something.foo">foo</Trans></div>;
  }

  return <div>{getSomething()}</div>;
}
`,
    },

    // Fixes case with JSX expression next to HTML tag
    {
      code: `
const Foo = () => <div>foo<code>bar</code></div>`,
      filename,
      errors: [{ message: transError }, { message: transError }],
    },

    /**
     * UNFIXABLE CASES
     */

    // Can't be fixed because its entirely non-alphanumeric
    {
      code: `const Foo = () => <div>-</div>`,
      filename,
      errors: [{ message: transError }],
    },

    // Can't be fixed because it has an expression sibling
    {
      code: `const Foo = () => <div>Hello {name}</div>`,
      filename,
      errors: [{ message: transError }],
    },

    // Can't be fixed because it contains HTML entities
    {
      code: `const Foo = () => <div>Something&nbsp;</div>`,
      filename,
      errors: [{ message: transError }],
    },

    // Can't be fixed because the text is too long to summarise nicely
    {
      code: `const Foo = () => <div>This is something with lots of text that we don't want to translate automatically</div>`,
      filename,
      errors: [{ message: transError }],
    },

    // Can't be fixed because it has an HTML sibling
    {
      code: `const Foo = () => <div>something <code>foo bar</code></div>`,
      filename,
      errors: [{ message: transError }, { message: transError }],
    },

    // Can't be fixed because its not in a function/component
    {
      code: `<div>Untranslated text</div>`,
      filename,
      errors: [{ message: transError }],
    },

    // Can't be fixed because its a JSXExpression in an attribute
    {
      code: `const Foo = () => <div title={"foo"} />`,
      filename,
      errors: [{ message: propsError }],
    },

    // Can't be fixed because it's not in the right directory/location
    {
      code: `const Foo = () => <div>Untranslated text</div>`,
      filename: 'public/something-else/foo/SomeOtherFile.tsx',
      errors: [{ message: transError }],
    },
  ],
});
