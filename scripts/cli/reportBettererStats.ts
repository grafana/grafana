import { betterer } from '@betterer/betterer';
import { camelCase } from 'lodash';

function logStat(name: string, value: number) {
  // Note that this output format must match the parsing in ci-frontend-metrics.sh
  // which expects the two values to be separated by a space
  console.log(`${name} ${value}`);
}
/**
 * Array of regexes + name overrides for legacy checks that have been moved to ESLint
 *
 * This is so we can still report things like "gfFormUsage..." as "noGfFormUsage_gfFormUsage..."
 * rather than "betterEslint_gfFormUsage..." for continuity on our dashboards
 */
const legacyChecksToTransform = [
  { messageRegex: /gfFormUsage/i, prefix: 'noGfFormUsage' },
  { messageRegex: /noUndocumentedStories/i, prefix: 'noUndocumentedStories' },
  { messageRegex: /noSkippingOfA11YTests/i, prefix: 'noSkippingA11YTestsInStories' },
];

async function main() {
  const results = await betterer.results();

  for (const testResults of results.resultSummaries) {
    const countByMessage = {};
    const name = camelCase(testResults.name);
    Object.values(testResults.details)
      .flatMap((v) => v)
      .forEach((detail) => {
        const message = camelCase(detail.message);
        const nameToUse =
          legacyChecksToTransform.find((v) => {
            return v.messageRegex.test(message);
          })?.prefix || name;

        const metricName = `${nameToUse}_${message}`;

        if (metricName in countByMessage) {
          countByMessage[metricName]++;
        } else {
          countByMessage[metricName] = 1;
        }
      });

    for (const [metricName, count] of Object.entries<number>(countByMessage)) {
      logStat(metricName, count);
    }
  }
}

main().catch(console.error);
