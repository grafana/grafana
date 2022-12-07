import { regexp } from '@betterer/regexp';
import { BettererFileTest } from '@betterer/betterer';
import { ESLint, Linter } from 'eslint';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

export default {
  'no enzyme tests': () => countEnzymeTests().include('**/*.test.*'),
  'better eslint': () => countEslintErrors().include('**/*.{ts,tsx}'),
  'no undocumented stories': () => countUndocumentedStories().include('**/*.story.tsx'),
};

function countEnzymeTests() {
  const cwd = process.cwd();
  let found = false;
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    filePaths.forEach((filePath) => {
      if (!isPathRelativeTo(cwd, filePath)) {
        return;
      }
      if (filePath.match(/\.test\.(ts|tsx)$/)) {
        // get file contents
        const fileContents = readFileSync(filePath, 'utf8');
        if (fileContents.match(/from 'enzyme'/)) {
          const file = fileTestResult.addFile(filePath, '');
          // Add the issue to the first character of the file:
          file.addIssue(0, 0, 'No enzyme tests are allowed, please use react-testing-library');
          found = true;
        }
      }
    });
    if (!found) {
      fileTestResult
        .addFile(path.resolve(cwd, 'keep-empty'), '')
        .addIssue(0, 0, 'fake error to prevent betterer report from blowing up');
    }
  });
}

function countUndocumentedStories() {
  const cwd = process.cwd();
  let found = false;
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    filePaths.forEach((filePath) => {
      if (!isPathRelativeTo(cwd, filePath)) {
        return;
      }
      if (!existsSync(filePath.replace(/\.story.tsx$/, '.mdx'))) {
        found = true;
        // In this case the file contents don't matter:
        const file = fileTestResult.addFile(filePath, '');
        // Add the issue to the first character of the file:
        file.addIssue(0, 0, 'No undocumented stories are allowed, please add an .mdx file with some documentation');
      }
    });
    if (!found) {
      fileTestResult
        .addFile(path.resolve(cwd, 'keep-empty'), '')
        .addIssue(0, 0, 'fake error to prevent betterer report from blowing up');
    }
  });
}

function countEslintErrors() {
  return new BettererFileTest(async (filePaths, fileTestResult, resolver) => {
    const { baseDirectory } = resolver;
    const cwd = process.cwd();
    const cli = new ESLint({ cwd: baseDirectory });
    let found = false;

    fileTestResult
      .addFile(path.resolve(cwd, 'keep-empty'), '')
      .addIssue(0, 0, 'fake error to prevent betterer report from blowing up');

    await Promise.all(
      filePaths.map(async (filePath) => {
        if (!isPathRelativeTo(cwd, filePath)) {
          return;
        }
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
              found = true;
              file.addIssue(0, 0, message.message, `${index}`);
            });
          });
        if (!found) {
          fileTestResult
            .addFile(path.resolve(cwd, 'keep-empty'), '')
            .addIssue(0, 0, 'fake error to prevent betterer report from blowing up');
        }
      })
    );
  });
}

function isPathRelativeTo(parent: string, dir: string) {
  const relative = path.relative(parent, dir);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
