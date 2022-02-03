// .betterer.ts
import { BettererTest } from '@betterer/betterer';
import { smaller } from '@betterer/constraints';
import { readFileSync } from 'node:fs';

export default {
  'number of console logs when running tests should shrink': () =>
    new BettererTest({
      test: () => getConsoleMessagesInTestOutput('log'),
      constraint: smaller,
      goal: 0
    }),
  'number of console warnings when running tests should shrink': () =>
    new BettererTest({
      test: () => getConsoleMessagesInTestOutput('warn'),
      constraint: smaller,
      goal: 0
    }),
  'number of console errors when running tests should shrink': () =>
    new BettererTest({
      test: () => getConsoleMessagesInTestOutput('error'),
      constraint: smaller,
      goal: 0
    })
};

type ConsoleMessageType = 'error' | 'log' | 'warn';

function getConsoleMessagesInTestOutput(type: ConsoleMessageType): number {
  const file = readFileSync('./jestResults.log', { encoding: 'utf8' });
  const lines = file.split('\n') // get each line
  const regex = new RegExp(`^\\s*console.${type}$`);
  // filter each line to get the ones that start with console.error/log/warn
  let linesContainingConsole = lines.filter(line => regex.test(line))
  return linesContainingConsole.length;
}
