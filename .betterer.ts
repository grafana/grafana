import { BettererFileTest } from '@betterer/betterer';
import { ESLint } from 'eslint';

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
};

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
