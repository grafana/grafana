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

const filename = 'public/app/features/some-feature/SomeFile.tsx';

const ruleTester = new RuleTester();

ruleTester.run('eslint no-untranslated-strings', noUntranslatedStrings, {
  test: [],
  valid: [
    {
      name: 'Text in Trans component',
      code: `const Foo = () => <Bar><Trans>Translated text</Trans></Bar>`,
    },
    {
      name: 'Text in Trans component with whitespace/JSXText elements',
      code: `const Foo = () => <Bar>
      <Trans>
        Translated text
    </Trans>   </Bar>`,
    },
    {
      name: 'Empty component',
      code: `<div>     </div>`,
    },
    {
      name: 'Text using t() function',
      code: `<div>{t('translated.key', 'Translated text')}</div>`,
    },
    {
      name: 'Prop using t() function',
      code: `<div aria-label={t('aria.label', 'Accessible label')} />`,
    },
    {
      name: 'Empty string prop',
      code: `<div title="" />`,
    },
    {
      name: 'Prop using boolean',
      code: `<div title={false} />`,
    },
    {
      name: 'Prop using number',
      code: `<div title={0} />`,
    },
    {
      name: 'Prop using null',
      code: `<div title={null} />`,
    },
    {
      name: 'Prop using undefined',
      code: `<div title={undefined} />`,
    },
    {
      name: 'Variable interpolation',
      code: `<div>{variable}</div>`,
    },
    {
      name: 'Entirely non-alphanumeric text (prop)',
      code: `<div title="-" />`,
    },
    {
      name: 'Entirely non-alphanumeric text',
      code: `<div>-</div>`,
    },
    {
      name: 'Non-alphanumeric siblings',
      code: `<div>({variable})</div>`,
    },
    {
      name: "Ternary in an attribute we don't care about",
      code: `<div icon={isAThing ? 'Foo' : 'Bar'} />`,
    },
    {
      name: 'Ternary with falsy strings',
      code: `<div icon={isAThing ? foo : ''} />`,
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
      name: 'Basic untranslated text in component',
      code: `
const Foo = () => <div>Untranslated text</div>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
              output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><Trans i18nKey="some-feature.foo.untranslated-text">Untranslated text</Trans></div>`,
            },
          ],
        },
      ],
    },

    {
      name: 'Text inside JSXElement, not in a function',
      code: `const thing = <div>foo</div>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
              output: `import { Trans } from 'app/core/internationalization';
const thing = <div><Trans i18nKey="some-feature.thing.foo">foo</Trans></div>`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes medium length strings',
      code: `
const Foo = () => <div>This is a longer string that we will translate</div>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
              output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><Trans i18nKey="some-feature.foo.longer-string-translate">This is a longer string that we will translate</Trans></div>`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes short strings with many words',
      code: `
const Foo = () => <div>lots of sho rt word s to be filt ered</div>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
              output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><Trans i18nKey="some-feature.foo.lots-of-sho-rt-word-s">lots of sho rt word s to be filt ered</Trans></div>`,
            },
          ],
        },
      ],
    },

    {
      name: 'expression',
      code: `
const foo = <>hello</>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
              output: `
import { Trans } from 'app/core/internationalization';
const foo = <><Trans i18nKey="some-feature.foo.hello">hello</Trans></>`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes strings in JSX in props',
      code: `
const Foo = () => <div><TestingComponent someProp={<>Test</>} /></div>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
              output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><TestingComponent someProp={<><Trans i18nKey="some-feature.foo.test">Test</Trans></>} /></div>`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes and uses ID from attribute if exists',
      code: `
import { t } from 'app/core/internationalization';
const Foo = () => <div id="someid" title="foo"/>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStringsProp',
          suggestions: [
            {
              messageId: 'wrapWithT',
              output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div id="someid" title={t("some-feature.foo.someid-title-foo", "foo")}/>`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes correctly when Trans import already exists',
      code: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div>Untranslated text</div>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
              output: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div><Trans i18nKey="some-feature.foo.untranslated-text">Untranslated text</Trans></div>`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes correctly when t() import already exists',
      code: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title="foo" />`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStringsProp',
          suggestions: [
            {
              messageId: 'wrapWithT',
              output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", "foo")} />`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes correctly when import exists but needs to add t()',
      code: `
import { Trans } from 'app/core/internationalization';
const Foo = () => <div title="foo" />`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStringsProp',
          suggestions: [
            {
              messageId: 'wrapWithT',
              output: `
import { Trans, t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", "foo")} />`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes correctly with a Class component',
      code: `
class Foo extends React.Component {
  render() {
    return <div>untranslated text</div>;
  }
}`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
              output: `
import { Trans } from 'app/core/internationalization';
class Foo extends React.Component {
  render() {
    return <div><Trans i18nKey="some-feature.foo.untranslated-text">untranslated text</Trans></div>;
  }
}`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes basic prop case',
      code: `
const Foo = () => <div title="foo" />`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStringsProp',
          suggestions: [
            {
              messageId: 'wrapWithT',
              output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", "foo")} />`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes prop case with string literal inside expression container',
      code: `
const Foo = () => <div title={"foo"} />`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStringsProp',
          suggestions: [
            {
              messageId: 'wrapWithT',
              output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", "foo")} />`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes prop case with double quotes in value',
      code: `
const Foo = () => <div title='"foo"' />`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStringsProp',
          suggestions: [
            {
              messageId: 'wrapWithT',
              output: `
import { t } from 'app/core/internationalization';
const Foo = () => <div title={t("some-feature.foo.title-foo", '"foo"')} />`,
            },
          ],
        },
      ],
    },

    {
      name: 'Fixes case with nested functions/components',
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
      errors: [
        {
          messageId: 'noUntranslatedStrings',
          suggestions: [
            {
              messageId: 'wrapWithTrans',
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
          ],
        },
      ],
    },

    /**
     * UNFIXABLE CASES
     */

    {
      name: 'Multiple untranslated strings in one element',
      code: `const Foo = () => <div>test {name} example</div>`,
      filename,
      errors: [
        {
          messageId: 'noUntranslatedStrings',
        },
      ],
    },

    {
      name: 'Cannot fix text with expression sibling',
      code: `const Foo = () => <div>{name} Hello</div>`,
      filename,
      errors: [{ messageId: 'noUntranslatedStrings' }],
    },

    {
      name: 'Cannot fix text with expression sibling in fragment',
      code: `
const Foo = () => {
  const bar = {
    baz: (<>Hello {name}</>)
  }
}`,
      filename,
      errors: [{ messageId: 'noUntranslatedStrings' }],
    },

    {
      name: 'Cannot fix text containing HTML entities',
      code: `const Foo = () => <div>Something&nbsp;</div>`,
      filename,
      errors: [{ messageId: 'noUntranslatedStrings' }],
    },

    {
      name: 'Cannot fix text that is too long',
      code: `const Foo = () => <div>This is something with lots of text that we don't want to translate automatically</div>`,
      filename,
      errors: [{ messageId: 'noUntranslatedStrings' }],
    },

    {
      name: 'Cannot fix prop text that is too long',
      code: `const Foo = () => <div title="This is something with lots of text that we don't want to translate automatically" />`,
      filename,
      errors: [{ messageId: 'noUntranslatedStringsProp' }],
    },

    {
      name: 'Cannot fix text with HTML sibling',
      code: `const Foo = () => <div>something <code>foo bar</code></div>`,
      filename,
      errors: [{ messageId: 'noUntranslatedStrings' }],
    },

    {
      name: 'JSXAttribute not in a function',
      code: `<div title="foo" />`,
      filename,
      errors: [{ messageId: 'noUntranslatedStringsProp' }],
    },

    {
      name: 'Cannot fix JSXExpression in attribute if it is template literal',
      code: `const Foo = () => <div title={\`foo\`} />`,
      filename,
      errors: [{ messageId: 'noUntranslatedStringsProp' }],
    },

    {
      name: 'Cannot fix text outside correct directory location',
      code: `const Foo = () => <div>Untranslated text</div>`,
      filename: 'public/something-else/foo/SomeOtherFile.tsx',
      errors: [{ messageId: 'noUntranslatedStrings' }],
    },

    {
      name: 'Invalid when ternary with string literals',
      code: `const Foo = () => <div>{isAThing ? 'Foo' : 'Bar'}</div>`,
      filename,
      errors: [{ messageId: 'noUntranslatedStrings' }, { messageId: 'noUntranslatedStrings' }],
    },
    {
      name: 'Invalid when ternary with string literals - prop',
      code: `const Foo = () => <div title={isAThing ? 'Foo' : 'Bar'} />`,
      filename,
      errors: [{ messageId: 'noUntranslatedStringsProp' }, { messageId: 'noUntranslatedStringsProp' }],
    },
  ],
});
