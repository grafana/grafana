import { regexp } from '@betterer/regexp';
import { BettererFileTest, BettererFileTestResult } from '@betterer/betterer';
import { ESLint, Linter } from 'eslint';
import { existsSync } from 'fs';
import path from 'path';
import glob from 'glob';
import fs from 'fs';
import { Worker } from 'worker_threads';

// function that takes a string and writes it to log.log
function log(str: string) {
  const logPath = path.join(__dirname, 'log.log');
  fs.appendFileSync(logPath, str + '\n');
}

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
    glob('**/.eslintrc', (err, files) => {
      if (err) {
        reject(err);
      }
      resolve(files);
    });
  });
}
const baseRules: Partial<Linter.RulesRecord> = {
  '@typescript-eslint/no-explicit-any': 'error',
};

const nonTestFilesRules: Partial<Linter.RulesRecord> = {
  ...baseRules,
  '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
};

async function countEslintErrorsThread({
  rules,
  baseDirectory,
  filePaths,
  fileTestResult,
}: {
  rules: Partial<Linter.RulesRecord>;
  baseDirectory: string;
  filePaths: string[];
  fileTestResult: BettererFileTestResult;
}) {
  const cli = new ESLint({ cwd: baseDirectory });
  const linterOptions = (await cli.calculateConfigForFile(filePaths[0])) as Linter.Config;
  const runner = new ESLint({
    baseConfig: {
      ...linterOptions,
      rules: rules,
    },
    useEslintrc: false,
    cwd: baseDirectory,
  });
  const lintResults = await runner.lintFiles(filePaths);
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

function countEslintErrors() {
  return new BettererFileTest(async (filePaths, fileTestResult, resolver) => {
    const { baseDirectory } = resolver;
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

    const promises: Array<Promise<void>> = [];
    const workers: Worker[] = [];
    for (const configPath of Object.keys(fileGroups)) {
      const rules = configPath.endsWith('-test') ? baseRules : nonTestFilesRules;
      const worker = new Worker('./.betterer.worker.js', {
        workerData: {
          rules,
          baseDirectory,
          filePaths: fileGroups[configPath],
        },
      });
      workers.push(worker);
      worker.on('message', (message) => {
        console.log('got message', message);
        const file = fileTestResult.addFile(message.filePath, '');
        file.addIssue(0, 0, message.message, `${message.index}`);
      });
      promises.push(
        new Promise((resolve) => {
          worker.on('exit', () => {
            resolve();
          });
        })
      );
      // promises.push(
      //   countEslintErrorsThread({
      //     rules,
      //     baseDirectory,
      //     filePaths: fileGroups[configPath],
      //     fileTestResult,
      //   })
      // );
    }
    await Promise.all(promises);
  });
}
