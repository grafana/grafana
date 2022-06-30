import { regexp } from '@betterer/regexp';
import { eslint } from '@betterer/eslint';
import { BettererFileTest } from '@betterer/betterer';

export default {
  'no enzyme tests': () => regexp(/from 'enzyme'/g).include('**/*.test.*'),
  'better eslint': () =>
    eslint({
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never',
        },
      ],
    }).include('**/*.{ts,tsx}'),
  'no undocumented stories': () => countUndocumentedStories().include('**/*.{story.tsx,mdx}'),
};

function countUndocumentedStories() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    const storyFilePaths = filePaths.filter((filePath) => filePath.endsWith('story.tsx'));
    const mdxFilePaths = filePaths.filter((filePath) => filePath.endsWith('mdx'));
    storyFilePaths.forEach((filePath) => {
      if (!mdxFilePaths.includes(filePath.replace(/\.story.tsx$/, '.mdx'))) {
        // In this case the file contents don't matter:
        const file = fileTestResult.addFile(filePath, '');
        // Add the issue to the first character of the file:
        file.addIssue(0, 0, 'No undocumented stories are allowed, please add an .mdx file with some documentation');
      }
    });
  });
}
