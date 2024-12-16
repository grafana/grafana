// @ts-check
import { betterer } from '@betterer/betterer';
import _ from 'lodash';

function logStat(name, value) {
  // Note that this output format must match the parsing in ci-frontend-metrics.sh
  // which expects the two values to be separated by a space
  console.log(`${name} ${value}`);
}

async function main() {
  const results = await betterer.results();

  for (const testResults of results.resultSummaries) {
    const countByMessage = {};
    const name = _.camelCase(testResults.name);
    Object.values(testResults.details)
      .flatMap((v) => v)
      .forEach((detail) => {
        const message = _.camelCase(detail.message);
        const metricName = `${name}_${message}`;
        if (metricName in countByMessage) {
          countByMessage[metricName]++;
        } else {
          countByMessage[metricName] = 1;
        }
      });

    for (const [metricName, count] of Object.entries(countByMessage)) {
      logStat(metricName, count);
    }
  }
}

main().catch(console.error);
