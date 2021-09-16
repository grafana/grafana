import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from '@grafana/data';
import { parseMatcher } from './alertmanager';

// parses comma separated matchers like "foo=bar,baz=~bad*" into SilenceMatcher[]
export function parseQueryParamMatchers(paramValue: string): Matcher[] {
  return paramValue
    .split(',')
    .filter((x) => !!x.trim())
    .map((x) => parseMatcher(x.trim()));
}

export const getMatcherQueryParams = (labels: Labels) => {
  return `matchers=${encodeURIComponent(
    Object.entries(labels)
      .filter(([labelKey]) => !(labelKey.startsWith('__') && labelKey.endsWith('__')))
      .map(([labelKey, labelValue]) => {
        return `${labelKey}=${labelValue}`;
      })
      .join(',')
  )}`;
};
