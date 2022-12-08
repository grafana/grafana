import { regexp } from '@betterer/regexp';
import { BettererFileTest } from '@betterer/betterer';
import { ESLint, Linter } from 'eslint';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import path from 'path';
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

async function findEslintConfigFiles(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const findEslintFiles = exec("find . -iname '.eslintrc*' -not -path '*/node_modules/*'", (err, stdout) => {
      if (err) {
        reject(err);
      }
      const files = stdout.split('\n').filter((file) => !!file.trim());
      resolve(files);
    });
  });
}

function countEslintErrors() {
  return new BettererFileTest(async (filePaths, fileTestResult, resolver) => {
    const { baseDirectory } = resolver;
    const cli = new ESLint({ cwd: baseDirectory });

    const testFiles: string[] = [];
    const codeFiles: string[] = [];

    const eslintConfigFiles = await findEslintConfigFiles();
    const eslintConfigMainPaths = eslintConfigFiles.map((file) => path.resolve(path.dirname(file)));

    filePaths.forEach((filePath) => {
      const isTestFile =
        filePath.endsWith('.test.tsx') ||
        filePath.endsWith('.test.ts') ||
        filePath.includes('__mocks__') ||
        filePath.includes('public/test/');
      if (isTestFile) {
        testFiles.push(filePath);
      } else {
        codeFiles.push(filePath);
      }
    });

    const baseRules: Partial<Linter.RulesRecord> = {
      '@typescript-eslint/no-explicit-any': 'error',
    };

    const nonTestFilesRules: Partial<Linter.RulesRecord> = {
      ...baseRules,
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    };

    const fileGroups: Record<string, string[]> = {};

    for (const filePath of filePaths) {
      let configPath = eslintConfigMainPaths.find((configPath) => filePath.startsWith(configPath)) ?? '';
      const isTestFile =
        filePath.endsWith('.test.tsx') ||
        filePath.endsWith('.test.ts') ||
        filePath.includes('__mocks__') ||
        filePath.includes('public/test/');
      if (isTestFile) {
        configPath += '-test';
      }
      if (!fileGroups[configPath]) {
        fileGroups[configPath] = [];
      }
      fileGroups[configPath].push(filePath);
    }

    for (const configPath of Object.keys(fileGroups)) {
      const rules = configPath.endsWith('-test') ? baseRules : nonTestFilesRules;
      const linterOptions = (await cli.calculateConfigForFile(fileGroups[configPath][0])) as Linter.Config;
      const runner = new ESLint({
        baseConfig: {
          ...linterOptions,
          rules: rules,
        },
        useEslintrc: false,
        cwd: baseDirectory,
      });
      const lintResults = await runner.lintFiles(fileGroups[configPath]);
      lintResults
        .filter((lintResult) => lintResult.source)
        .forEach((lintResult) => {
          const { messages } = lintResult;
          const filePath = lintResult.filePath;
          const file = fileTestResult.addFile(filePath, '');
          messages.forEach((message, index) => {
            file.addIssue(0, 0, message.message, `${index}`);
          });
        });
    }
  });
}
