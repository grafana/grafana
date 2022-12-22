import { TimeRange } from '@grafana/data';

function roundMsToMin(milliseconds: number): number {
  return roundSecToMin(milliseconds / 1000);
}

function roundSecToMin(seconds: number): number {
  return Math.floor(seconds / 60);
}

export function shouldRefreshLabels(range?: TimeRange, prevRange?: TimeRange): boolean {
  if (range && prevRange) {
    const sameMinuteFrom = roundMsToMin(range.from.valueOf()) === roundMsToMin(prevRange.from.valueOf());
    const sameMinuteTo = roundMsToMin(range.to.valueOf()) === roundMsToMin(prevRange.to.valueOf());
    // If both are same, don't need to refresh
    return !(sameMinuteFrom && sameMinuteTo);
  }
  return false;
}

// Loki regular-expressions use the RE2 syntax (https://github.com/google/re2/wiki/Syntax),
// so every character that matches something in that list has to be escaped.
// the list of meta characters is: *+?()|\.[]{}^$
// we make a javascript regular expression that matches those characters:
const RE2_METACHARACTERS = /[*+?()|\\.\[\]{}^$]/g;
function escapeLokiRegexp(value: string): string {
  return value.replace(RE2_METACHARACTERS, '\\$&');
}

// based on the openmetrics-documentation, the 3 symbols we have to handle are:
// - \n ... the newline character
// - \  ... the backslash character
// - "  ... the double-quote character
export function escapeLabelValueInExactSelector(labelValue: string): string {
  return labelValue.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

export function unescapeLabelValue(labelValue: string): string {
  return labelValue.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function escapeLabelValueInRegexSelector(labelValue: string): string {
  return escapeLabelValueInExactSelector(escapeLokiRegexp(labelValue));
}

export function escapeLabelValueInSelector(labelValue: string, selector?: string): string {
  return isRegexSelector(selector)
    ? escapeLabelValueInRegexSelector(labelValue)
    : escapeLabelValueInExactSelector(labelValue);
}

export function isRegexSelector(selector?: string) {
  if (selector && (selector.includes('=~') || selector.includes('!~'))) {
    return true;
  }
  return false;
}

export function isBytesString(string: string) {
  const BYTES_KEYWORDS = [
    'b',
    'kib',
    'Kib',
    'kb',
    'KB',
    'mib',
    'Mib',
    'mb',
    'MB',
    'gib',
    'Gib',
    'gb',
    'GB',
    'tib',
    'Tib',
    'tb',
    'TB',
    'pib',
    'Pib',
    'pb',
    'PB',
    'eib',
    'Eib',
    'eb',
    'EB',
  ];
  const regex = new RegExp(`^(?:-?\\d+(?:\\.\\d+)?)(?:${BYTES_KEYWORDS.join('|')})$`);
  const match = string.match(regex);
  return !!match;
}
