import { SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';

// parses comma separated matchers like "foo=bar,baz=~bad*" into SilenceMatcher[]
export function parseQueryParamMatchers(paramValue: string): SilenceMatcher[] {
  const matchers: SilenceMatcher[] = [];
  paramValue
    .split(',')
    .map((x) => x.trim())
    .forEach((item) => {
      // not supported
      if (item.includes('!=') || item.includes('!~')) {
        return;
      }
      if (item.includes('=~')) {
        const [name, value] = item.split('=~');
        if (name && value) {
          matchers.push({
            name,
            value,
            isRegex: true,
          });
        }
      } else if (item.includes('=')) {
        const [name, value] = item.split('=');
        if (name && value) {
          matchers.push({
            name,
            value,
            isRegex: false,
          });
        }
      }
    });
  return matchers;
}
