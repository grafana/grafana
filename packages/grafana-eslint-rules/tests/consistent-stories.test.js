import { RuleTester } from 'eslint';

import consistentStories from '../rules/consistent-story-titles.cjs';

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

ruleTester.run('eslint consistent-stories', consistentStories, {
  valid: [
    {
      name: 'simple title',
      code: `export default { title: 'Button' };`,
      filename: 'Button.story.tsx',
    },
    {
      name: 'one section',
      code: `export default { title: 'Components/Button' };`,
      filename: 'Button.story.tsx',
    },
    {
      name: 'deprecated can have 3 sections',
      code: `export default { title: 'Components/Deprecated/Button' };`,
      filename: 'Button.story.tsx',
    },
    {
      name: 'not a story file',
      code: `export default { title: 'Components/Forms/Button/Extra/Section' };`,
      filename: 'Button.tsx',
    },
    {
      name: 'non-string title',
      code: `export default { title: 123 };`,
      filename: 'Button.story.tsx',
    },
    {
      name: 'no title property',
      code: `export default { component: Button };`,
      filename: 'Button.story.tsx',
    },
    {
      name: 'variable assignment - simple title',
      code: `
const storyConfig = { title: 'Button' };
export default storyConfig;`,
      filename: 'Button.story.tsx',
    },
    {
      name: 'variable assignment - one section',
      code: `
const storyConfig = { title: 'Components/Button' };
export default storyConfig;`,
      filename: 'Button.story.tsx',
    },
    {
      name: 'variable assignment - with Deprecated',
      code: `
const storyConfig = { title: 'Components/Deprecated/Button' };
export default storyConfig;`,
      filename: 'Button.story.tsx',
    },
  ],
  invalid: [
    {
      name: 'too many sections without Deprecated',
      code: `export default { title: 'Components/Forms/Button' };`,
      filename: 'Button.story.tsx',
      errors: [
        {
          messageId: 'invalidTitle',
        },
      ],
    },
    {
      name: 'too many sections without Deprecated',
      code: `export default { title: 'Components/Forms/Button/Extra' };`,
      filename: 'Button.story.tsx',
      errors: [
        {
          messageId: 'invalidTitle',
        },
      ],
    },
    {
      name: 'with spaces around sections',
      code: `export default { title: 'Components / Forms / Button' };`,
      filename: 'Button.story.tsx',
      errors: [
        {
          messageId: 'invalidTitle',
        },
      ],
    },
    {
      name: 'variable assignment - too many sections',
      code: `
const storyConfig = { title: 'Components/Forms/Button' };
export default storyConfig;`,
      filename: 'Button.story.tsx',
      errors: [
        {
          messageId: 'invalidTitle',
        },
      ],
    },
  ],
});
