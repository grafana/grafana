import { regexp } from '@betterer/regexp';
import { BettererFileTest } from '@betterer/betterer';
import { ESLint, Linter } from 'eslint';

export default {
  'no enzyme tests': () => regexp(/from 'enzyme'/g).include('**/*.test.*'),
  'better eslint': () => countEslintErrors().include('**/*.{ts,tsx}'),
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

function countEslintErrors() {
  return new BettererFileTest(async (filePaths, fileTestResult, resolver) => {
    const { baseDirectory } = resolver;
    const cli = new ESLint({ cwd: baseDirectory });

    await Promise.all(
      filePaths.map(async (filePath) => {
        const linterOptions = (await cli.calculateConfigForFile(filePath)) as Linter.Config;

        const rules: Partial<Linter.RulesRecord> = {
          '@typescript-eslint/no-explicit-any': 'error',
        };

        if (!filePath.endsWith('.test.tsx')) {
          rules['@typescript-eslint/consistent-type-assertions'] = [
            'error',
            {
              assertionStyle: 'never',
            },
          ];
        }

        const runner = new ESLint({
          baseConfig: {
            ...linterOptions,
            rules,
          },
          useEslintrc: false,
          cwd: baseDirectory,
        });

        const lintResults = await runner.lintFiles([filePath]);
        lintResults
          .filter((lintResult) => lintResult.source)
          .forEach((lintResult) => {
            const { messages } = lintResult;
            const file = fileTestResult.addFile(filePath, '');
            messages.forEach((message) => {
              file.addIssue(0, 0, message.message);
            });
          });
      })
    );
  });
}
