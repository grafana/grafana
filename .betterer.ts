import { BettererFileTest } from '@betterer/betterer';
import { promises as fs } from 'fs';
import { ESLint, Linter } from 'eslint';
import path from 'path';
import { glob } from 'glob';

// Why are we ignoring these?
// They're all deprecated/being removed so doesn't make sense to fix types
const eslintPathsToIgnore = [
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
    // Just bail early if there's no files to test. Prevents trying to get the base config from failing
    if (filePaths.length === 0) {
      return;
    }

    const { baseDirectory } = resolver;
    const cli = new ESLint({ cwd: baseDirectory });

    // Get the base config to set up parsing etc correctly
    // this is by far the slowest part of this code. It takes eslint about 2 seconds just to find the config
    const baseConfig = await cli.calculateConfigForFile(filePaths[0]);

    const baseRules: Partial<Linter.RulesRecord> = {
      '@emotion/syntax-preference': [2, 'object'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@grafana/no-aria-label-selectors': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@grafana/ui*', '*/Layout/*'],
              importNames: ['Layout', 'HorizontalGroup', 'VerticalGroup'],
              message: 'Use Stack component instead.',
            },
          ],
        },
      ],
    };

    const config: Linter.Config = {
      ...baseConfig,
      rules: baseRules,

      // Be careful when specifying overrides for the same rules as in baseRules - it will... override
      // the same rule, not merge them with different configurations
      overrides: [
        {
          files: ['**/*.{ts,tsx}'],
          excludedFiles: ['*.{test,spec}.{ts,tsx}', '**/__mocks__/**', '**/public/test/**'],
          rules: {
            '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
          },
        },

        {
          files: ['public/app/**/*.{ts,tsx}'],
          rules: {
            'no-barrel-files/no-barrel-files': 'error',
          },
        },
        {
          files: ['public/**/*.tsx', 'packages/grafana-ui/**/*.tsx'],
          excludedFiles: [
            'public/app/plugins/**',
            '*.story.tsx',
            '*.{test,spec}.{ts,tsx}',
            '**/__mocks__/**',
            'public/test/**',
          ],
          rules: {
            '@grafana/no-untranslated-strings': 'error',
          },
        },
      ],
    };

    const runner = new ESLint({
      baseConfig: config,
      useEslintrc: false,
      cwd: baseDirectory,
    });

    const lintResults = await runner.lintFiles(Array.from(filePaths));
    lintResults
      .filter((lintResult) => lintResult.source)
      .forEach(({ messages, filePath }) => {
        const file = fileTestResult.addFile(filePath, '');
        messages.forEach((message, index) => {
          file.addIssue(0, 0, message.message, `${index}`);
        });
      });
  });
}
