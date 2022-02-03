// .betterer.ts
import { BettererTest } from '@betterer/betterer';
import { smaller } from '@betterer/constraints';
import { readFileSync } from 'node:fs';

export default {
  'number of console messages when running tests should shrink': () =>
    new BettererTest({
      test: () => getConsoleMessagesInTestOutput(),
      constraint: smaller,
      goal: 0
    })
};

function getConsoleMessagesInTestOutput(): number {
  const file = readFileSync('./jestResults.log', { encoding: 'utf8' });
  let lines = file.split('\n') // get each line
  // filter each line to get the ones that start with console.error/log/warn
  let linesContainingConsole = lines.filter(line => /^\s*console.(error|log|warn)$/.test(line))
  return linesContainingConsole.length;
}
