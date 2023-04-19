import { BettererFilePaths, BettererFileTest } from '@betterer/betterer';
import { promises as fs } from 'fs';
import { ESLint, Linter } from 'eslint';
import path from 'path';
import glob from 'glob';
import { exec, spawnSync } from 'child_process';
import { promisify } from 'util';

export default {
  'better eslint': () => countEslintErrors(),
  'no undocumented stories': () => countUndocumentedStories().include('**/*.story.tsx'),
};

function countUndocumentedStories() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    await Promise.all(
      filePaths.map(async (filePath) => {
        // look for .mdx import in the story file
        const regex = new RegExp("^import.*.mdx';$", 'gm');
        const fileText = await fs.readFile(filePath, 'utf8');
        if (!regex.test(fileText)) {
          // In this case the file contents don't matter:
          const file = fileTestResult.addFile(filePath, '');
          // Add the issue to the first character of the file:
          file.addIssue(0, 0, 'No undocumented stories are allowed, please add an .mdx file with some documentation');
        }
      })
    );
  });
}

const execPromise = promisify(exec);

function isFindAvailable() {
  const result = spawnSync('find', ['--version']);
  //@ts-ignore - code is not defined in the type definition
  return !(result.error && result.error.code === 'ENOENT');
}

async function getFilesToLint(files: BettererFilePaths): Promise<BettererFilePaths> {
  if (files.length) {
    return files.filter(
      (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('public/app/angular')
    );
  }

  const findCommand = 'find . -type f \\( -iname "*.ts" -o -iname "*.tsx" \\) -not -path \'*/\\.*\' -print';
  let findFiles: string[];

  if (isFindAvailable()) {
    const { stdout } = await execPromise(findCommand);
    findFiles = stdout.toString().trim().split('\n');
  } else {
    findFiles = await glob('**/*.{ts,tsx}', { ignore: ['**/.*', '**/.*/**'] });
  }

  return findFiles.filter((file) => file.includes('public/app/angular'));
}

async function getEslintConfigFiles(): Promise<string[]> {
  if (isFindAvailable()) {
    const findCommand = 'find . -type f -name ".eslintrc" -not -path \'*/\\.*\' -print';
    const { stdout } = await execPromise(findCommand);
    const findFiles = stdout.toString().trim().split('\n');
    return findFiles;
  }
  return await glob('**/.eslintrc');
}

function countEslintErrors() {
  // small optimization
  const eslintConfigPromise = getEslintConfigFiles();
  return new BettererFileTest(async (filePaths, fileTestResult, resolver) => {
    const { baseDirectory } = resolver;
    const cli = new ESLint({ cwd: baseDirectory });

    const filesToLint = await getFilesToLint(filePaths);

    const eslintConfigFiles = await eslintConfigPromise;
    const eslintConfigMainPaths = eslintConfigFiles.map((file) => path.resolve(path.dirname(file)));

    const baseRules: Partial<Linter.RulesRecord> = {
      '@typescript-eslint/no-explicit-any': 'error',
      '@grafana/no-aria-label-selectors': 'error',
    };

    const nonTestFilesRules: Partial<Linter.RulesRecord> = {
      ...baseRules,
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    };

    // group files by eslint config file
    // this will create two file groups for each eslint config file
    // one for test files and one for non-test files
    const fileGroups: Record<string, string[]> = {};

    for (const filePath of filesToLint) {
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
      // this is by far the slowest part of this code. It takes eslint about 2 seconds just to find the config
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
