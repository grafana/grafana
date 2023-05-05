export function isLogLineJSON(line: string): boolean {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch (error) {}
  // The JSON parser should only be used for log lines that are valid serialized JSON objects.
  return typeof parsed === 'object';
}

// This matches:
// first a label from start of the string or first white space, then any word chars until "="
// second either an empty quotes, or anything that starts with quote and ends with unescaped quote,
// or any non whitespace chars that do not start with quote
const LOGFMT_REGEXP = /(?:^|\s)([\w\(\)\[\]\{\}]+)=(""|(?:".*?[^\\]"|[^"\s]\S*))/;

export function isLogLineLogfmt(line: string): boolean {
  return LOGFMT_REGEXP.test(line);
}

export function isLogLinePacked(line: string): boolean {
  let parsed;
  try {
    parsed = JSON.parse(line);
    return parsed.hasOwnProperty('_entry');
  } catch (error) {
    return false;
  }
}
