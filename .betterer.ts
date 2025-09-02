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
  'no skipping a11y tests in stories': () => countSkippedA11yTestStories().include('**/*.story.tsx'),
  'no gf-form usage': () =>
    regexp(/gf-form/gm, 'gf-form usage has been deprecated. Use a component from @grafana/ui or custom CSS instead.')
      .include('**/*.{ts,tsx,html}')
      .exclude(new RegExp('packages/grafana-ui/src/themes/GlobalStyles')),
};

function countSkippedA11yTestStories() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    await Promise.all(
      filePaths.map(async (filePath) => {
        // look for skipped a11y tests
        const skipRegex = new RegExp("a11y: { test: 'off' }", 'gm');

        const fileText = await fs.readFile(filePath, 'utf8');

        const hasSkip = skipRegex.test(fileText);
        if (hasSkip) {
          // In this case the file contents don't matter:
          const file = fileTestResult.addFile(filePath, '');
          // Add the issue to the first character of the file:
          file.addIssue(0, 0, 'No skipping of a11y tests in stories. Please fix the component or story instead.');
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
