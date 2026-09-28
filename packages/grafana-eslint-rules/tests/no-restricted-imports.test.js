import { RuleTester } from 'eslint';
import { builtinRules } from 'eslint/use-at-your-own-risk';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

const noRestrictedImportsOptions = {
  paths: [
    {
      name: 'react-use',
      importNames: ['useCopyToClipboard'],
      message: 'Please import copyTextToClipboard from @grafana/ui instead.',
    },
  ],
};

const noRestrictedImportsRule = builtinRules.get('no-restricted-imports');
const ruleTester = new RuleTester();

ruleTester.run('react-use import restrictions', noRestrictedImportsRule, {
  valid: [
    {
      name: 'allowed react-use import',
      code: "import { useToggle } from 'react-use';",
      options: [noRestrictedImportsOptions],
    },
    {
      name: 'unrelated import',
      code: "import { useCopyToClipboard } from '@grafana/ui';",
      options: [noRestrictedImportsOptions],
    },
  ],
  invalid: [
    {
      name: 'useCopyToClipboard import',
      code: "import { useCopyToClipboard } from 'react-use';",
      options: [noRestrictedImportsOptions],
      errors: [
        {
          messageId: 'importNameWithCustomMessage',
          data: {
            importName: 'useCopyToClipboard',
            importSource: 'react-use',
            customMessage: 'Please import copyTextToClipboard from @grafana/ui instead.',
          },
        },
      ],
    },
    {
      name: 'aliased useCopyToClipboard import',
      code: "import { useCopyToClipboard as copyToClipboard } from 'react-use';",
      options: [noRestrictedImportsOptions],
      errors: [{ messageId: 'importNameWithCustomMessage' }],
    },
  ],
});
