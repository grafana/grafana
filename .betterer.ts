import { regexp } from '@betterer/regexp';
import { BettererFileTest } from '@betterer/betterer';
import { ESLint, Linter } from 'eslint';
import { existsSync } from 'fs';

export default {
  'no enzyme tests': () => regexp(/from 'enzyme'/g).include('**/*.test.*'),
  'better eslint': () => countEslintErrors().include('**/*.{ts,tsx}'),
  'no undocumented stories': () => countUndocumentedStories().include('**/*.story.tsx'),
};

function countUndocumentedStories() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    filePaths.forEach((filePath) => {
      if (!existsSync(filePath.replace(/\.story.tsx$/, '.mdx'))) {
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

        const isTestFile =
          filePath.endsWith('.test.tsx') ||
          filePath.endsWith('.test.ts') ||
          filePath.includes('__mocks__') ||
          filePath.includes('public/test/');

        if (!isTestFile) {
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
            messages.forEach((message, index) => {
              file.addIssue(0, 0, message.message, `${index}`);
            });
          });
      })
    );
  });
}
