import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { parseMatcher } from './alertmanager';

// parses comma separated matchers like "foo=bar,baz=~bad*" into SilenceMatcher[]
export function parseQueryParamMatchers(paramValue: string): Matcher[] {
  return paramValue.split(',').map((x) => parseMatcher(x.trim()));
}
