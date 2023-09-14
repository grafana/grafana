import { getLinkToDocs } from './getLinkToDocs';

export const renameByRegexHelper = () => {
  return `
  Use this transformation to rename parts of the query results using a regular expression and replacement pattern.

  You can specify a regular expression, which is only applied to matches, along with a replacement pattern that support back references. For example, let's imagine you're visualizing CPU usage per host and you want to remove the domain name. You could set the regex to '([^\.]+)\..+' and the replacement pattern to '$1', 'web-01.example.com' would become 'web-01'.
  ${getLinkToDocs()}
  `;
};
