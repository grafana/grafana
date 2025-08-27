//@ts-check
import lodash from 'lodash';
const { camelCase } = lodash;

/** @type {import('eslint').ESLint.FormatterFunction} */
export default function statsReporter(results, context) {
  /** @type {Record<string, number>} */
  const countByMessage = {};

  for (const result of results) {
    for (const message of result.messages) {
      const key = camelCase(message.message);
      countByMessage[key] = (countByMessage[key] || 0) + 1;
    }
  }

  return JSON.stringify(countByMessage, null, 2);
}
