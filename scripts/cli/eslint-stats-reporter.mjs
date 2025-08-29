//@ts-check
import lodash from 'lodash';
const { camelCase } = lodash;

/**
 * Rule IDs that are overly verbose and that we want to combine so they report more cleanly
 *
 * i.e. so we can report `reactHooksRulesOfHooks` instead of `reactHookFooIsCalledConditionallyReactHooksMust...`
 */
const rulesToCombine = ['react-hooks/rules-of-hooks', 'no-barrel-files/no-barrel-files'];

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
        message.ruleId && rulesToCombine.includes(message.ruleId)
          ? camelCase(message.ruleId)
          : camelCase(message.message);
      countByMessage[key] = (countByMessage[key] || 0) + 1;
    }
  }

  return Object.entries(countByMessage)
    .map(([key, value]) => {
      return `betterEslint_${key} ${value}`;
    })
    .join('\n');
}
