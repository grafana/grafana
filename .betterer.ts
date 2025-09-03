import { BettererFileTest } from '@betterer/betterer';
import { ESLint } from 'eslint';
import { promises as fs } from 'fs';

// Why are we ignoring these?
// They're all deprecated/being removed so doesn't make sense to fix types
const eslintPathsToIgnore = [
  'packages/grafana-ui/src/graveyard', // will be removed alongside angular in Grafana 12
  'public/app/angular', // will be removed in Grafana 12
  'public/app/plugins/panel/graph', // will be removed alongside angular in Grafana 12
  'public/app/plugins/panel/table-old', // will be removed alongside angular in Grafana 12
];

// Avoid using functions that report the position of the issues, as this causes a lot of merge conflicts
export default {
  'better eslint': () =>
    countEslintErrors()
      .include('**/*.{ts,tsx}')
      .exclude(new RegExp(eslintPathsToIgnore.join('|'))),
  'no undocumented stories': () => countUndocumentedStories().include('**/*.story.tsx'),
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

function countEslintErrors() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    // Just bail early if there's no files to test. Prevents trying to get the base config from failing
    if (filePaths.length === 0) {
      return;
    }

    const runner = new ESLint({
      overrideConfigFile: './.betterer.eslint.config.js',
      warnIgnored: false,
    });

    const lintResults = await runner.lintFiles(Array.from(filePaths));

    lintResults.forEach(({ messages, filePath }) => {
      const file = fileTestResult.addFile(filePath, '');
      messages
        .sort((a, b) => (a.message > b.message ? 1 : -1))
        .forEach((message, index) => {
          file.addIssue(0, 0, message.message, `${index}`);
        });
    });
  });
}
