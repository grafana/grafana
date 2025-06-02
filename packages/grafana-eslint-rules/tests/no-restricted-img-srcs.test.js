import { RuleTester } from 'eslint';

import noRestrictedImgSrcs from '../rules/no-restricted-img-srcs.cjs';

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

const ruleTester = new RuleTester();

ruleTester.run('eslint no-restricted-img-srcs', noRestrictedImgSrcs, {
  valid: [
    {
      name: 'uses build folder',
      code: `const foo = 'public/build/img/checkbox.png';`,
    },
    {
      name: 'uses import',
      code: `
import foo from 'img/checkbox.png';
const bar = foo;
const baz = <img src={foo} />;
`,
    },
    {
      name: 'plugin folder',
      code: `const foo = 'public/plugins/foo/checkbox.png';`,
    },
    {
      name: 'template literal',
      code: `const foo = \`something else\``,
    },
  ],
  invalid: [
    {
      name: 'references public folder',
      code: `
const foo = 'public/img/checkbox-128-icon.png';`,
      errors: [
        {
          messageId: 'publicImg',
          suggestions: [
            {
              messageId: 'importImage',
              output: `
import checkbox128IconPng from 'img/checkbox-128-icon.png';
const foo = checkbox128IconPng;`,
            },
            {
              messageId: 'useBuildFolder',
              output: `
const foo = 'public/build/img/checkbox-128-icon.png';`,
            },
          ],
        },
      ],
    },
    {
      name: 'template literal',
      code: `
const isDark = true ? 'dark' : 'light';
const foo = \`public/img/checkbox-128-icon-\${isDark}.png\`;`,
      errors: [
        {
          messageId: 'publicImg',
        },
      ],
    },
    {
      name: 'fixes jsx attribute',
      code: `<img src="public/img/checkbox.png" />`,
      errors: [
        {
          messageId: 'publicImg',
          suggestions: [
            {
              messageId: 'importImage',
              output: `import checkboxPng from 'img/checkbox.png';
<img src={checkboxPng} />`,
            },
            {
              messageId: 'useBuildFolder',
              output: `<img src="public/build/img/checkbox.png" />`,
            },
          ],
        },
      ],
    },
    {
      name: 'fixes with existing import',
      code: `
import checkboxPng from 'img/checkbox.png';
const foo = checkboxPng;
const bar = 'public/img/checkbox.png';`,
      errors: [
        {
          messageId: 'publicImg',
          suggestions: [
            {
              messageId: 'importImage',
              output: `
import checkboxPng from 'img/checkbox.png';
const foo = checkboxPng;
const bar = checkboxPng;`,
            },
            {
              messageId: 'useBuildFolder',
              output: `
import checkboxPng from 'img/checkbox.png';
const foo = checkboxPng;
const bar = 'public/build/img/checkbox.png';`,
            },
          ],
        },
      ],
    },
    {
      name: 'image elsewhere in public folder',
      code: `const foo = 'public/app/plugins/datasource/alertmanager/img/logo.svg';`,
      errors: [
        {
          messageId: 'publicImg',
          suggestions: [
            {
              messageId: 'importImage',
              output: `import logoSvg from 'app/plugins/datasource/alertmanager/img/logo.svg';
const foo = logoSvg;`,
            },
          ],
        },
      ],
    },
  ],
});
