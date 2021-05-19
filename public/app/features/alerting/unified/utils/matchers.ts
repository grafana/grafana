import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { parseMatcher } from './alertmanager';

// parses comma separated matchers like "foo=bar,baz=~bad*" into SilenceMatcher[]
export function parseQueryParamMatchers(paramValue: string): Matcher[] {
  return paramValue
    .split(',')
    .filter((x) => !!x.trim())
    .map((x) => parseMatcher(x.trim()));
}
