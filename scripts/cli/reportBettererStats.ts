import { betterer } from '@betterer/betterer';
import { camelCase } from 'lodash';

function logStat(name: string, value: number) {
  // Note that this output format must match the parsing in ci-frontend-metrics.sh
  // which expects the two values to be separated by a space
  console.log(`${name} ${value}`);
}

async function main() {
  const results = await betterer.results();

  for (const testResults of results.resultSummaries) {
    const name = camelCase(testResults.name);
    const count = Object.values(testResults.details).flatMap((v) => v).length;

    logStat(name, count);
  }
}

main().catch(console.error);
