//@ts-check
// eslint-disable-next-line lodash/import-scope -- lodash is a cjs module here
import lodash from 'lodash';
const { camelCase } = lodash;

/**
 * Keep existing message-based metric names so dashboards continue to work.
 * All other rules are combined by rule ID to avoid metrics that depend on source code or file paths.
 */
const rulesNotToCombine = [
  '@grafana/no-config-datasources',
  '@grafana/no-config-feature-toggles',
  '@grafana/no-config-panels',
  '@grafana/no-direct-local-storage-access',
  '@grafana/no-get-data-source-srv',
  // eslint-disable-next-line @grafana/no-gf-form -- Preserve the legacy metric for this rule.
  '@grafana/no-gf-form',
  '@grafana/require-no-margin',
  '@typescript-eslint/consistent-type-assertions',
  '@typescript-eslint/no-explicit-any',
  'react-hooks/exhaustive-deps',
  'react-prefer-function-component/react-prefer-function-component',
];

const legacyChecksToTransform = [
  { messageRegex: /gfFormUsage/i, prefix: 'noGfFormUsage' },
  { messageRegex: /skippingA11Y/i, prefix: 'noSkippingA11YTestsInStories' },
];

/**
 * Custom formatter that outputs suppressed rule violations in a format suitable for
 * consuming on our CI code stats scripts
 *
 * Output in the format:
 * @example
 * betterEslint_reactHooksRulesOfHooks 123
 * betterEslint_noBarrelFilesNoBarrelFiles 123
 *
 * @type {import('eslint').ESLint.FormatterFunction}
 */
export default function statsReporter(results) {
  /** @type {Record<string, number>} */
  const countByMessage = {};

  for (const result of results) {
    for (const message of result.suppressedMessages) {
      // eslint disable directives count as suppressions
      // we only want to report the case where everything is a file suppression
      const everySuppressionIsFile = message.suppressions.every((suppression) => suppression.kind === 'file');

      if (!everySuppressionIsFile) {
        continue;
      }

      const key =
        message.ruleId && !rulesNotToCombine.includes(message.ruleId)
          ? camelCase(message.ruleId)
          : camelCase(message.message);
      countByMessage[key] = (countByMessage[key] || 0) + 1;
    }
  }

  return Object.entries(countByMessage)
    .map(([key, value]) => {
      const prefix = legacyChecksToTransform.find((v) => v.messageRegex.test(key))?.prefix || 'betterEslint';
      return `${prefix}_${key} ${value}`;
    })
    .join('\n');
}
