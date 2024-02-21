import { BettererFileTest } from '@betterer/betterer';
import { promises as fs } from 'fs';
import { ESLint, Linter } from 'eslint';
import path from 'path';
import { glob } from 'glob';

// Why are we ignoring these?
// They're all deprecated/being removed so doesn't make sense to fix types
const eslintPathsToIgnore = [
  'packages/grafana-e2e', // deprecated.
  'public/app/angular', // will be removed in Grafana 11
  'public/app/plugins/panel/graph', // will be removed alongside angular
  'public/app/plugins/panel/table-old', // will be removed alongside angular
];

// Avoid using functions that report the position of the issues, as this causes a lot of merge conflicts
export default {
  'better eslint': () =>
    countEslintErrors()
      .include('**/*.{ts,tsx}')
      .exclude(new RegExp(eslintPathsToIgnore.join('|'))),
  'no undocumented stories': () => countUndocumentedStories().include('**/!(*.internal).story.tsx'),
  'no gf-form usage': () =>
    regexp(
      /gf-form/gm,
      'gf-form usage has been deprecated. Use a component from @grafana/ui or custom CSS instead.'
    ).include('**/*.{ts,tsx,html}'),
};

function countUndocumentedStories() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    await Promise.all(
      filePaths.map(async (filePath) => {
        // look for .mdx import in the story file
        const mdxImportRegex = new RegExp("^import.*\\.mdx';$", 'gm');
        // Looks for the "autodocs" string in the file
        const autodocsStringRegex = /autodocs/;

        const fileText = await fs.readFile(filePath, 'utf8');

        const hasMdxImport = mdxImportRegex.test(fileText);
        const hasAutodocsString = autodocsStringRegex.test(fileText);
        // If both .mdx import and autodocs string are missing, add an issue
        if (!hasMdxImport && !hasAutodocsString) {
          // In this case the file contents don't matter:
          const file = fileTestResult.addFile(filePath, '');
          // Add the issue to the first character of the file:
          file.addIssue(0, 0, 'No undocumented stories are allowed, please add an .mdx file with some documentation');
        }
      })
    );
  });
}

/**
 *  Generic regexp pattern matcher, similar to @betterer/regexp.
 *  The only difference is that the positions of the errors are not reported, as this may cause a lot of merge conflicts.
 */
function regexp(pattern: RegExp, issueMessage: string) {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    await Promise.all(
      filePaths.map(async (filePath) => {
        const fileText = await fs.readFile(filePath, 'utf8');
        const matches = fileText.match(pattern);
        if (matches) {
          // File contents doesn't matter, since we're not reporting the position
          const file = fileTestResult.addFile(filePath, '');
          matches.forEach(() => {
            file.addIssue(0, 0, issueMessage);
          });
        }
      })
    );
  });
}

function countEslintErrors() {
  return new BettererFileTest(async (filePaths, fileTestResult, resolver) => {
    const { baseDirectory } = resolver;
    const cli = new ESLint({ cwd: baseDirectory });

    const eslintConfigFiles = await glob('**/.eslintrc');
    const eslintConfigMainPaths = eslintConfigFiles.map((file) => path.resolve(path.dirname(file)));

    const baseRules: Partial<Linter.RulesRecord> = {
      '@emotion/syntax-preference': [2, 'object'],
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
