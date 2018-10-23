export const RATE_RANGES = ['1m', '5m', '10m', '30m', '1h'];

export function processLabels(labels, withName = false) {
  const values = {};
  labels.forEach(l => {
    const { __name__, ...rest } = l;
    if (withName) {
      values['__name__'] = values['__name__'] || [];
      if (values['__name__'].indexOf(__name__) === -1) {
        values['__name__'].push(__name__);
      }
    }

    Object.keys(rest).forEach(key => {
      if (!values[key]) {
        values[key] = [];
      }
      if (values[key].indexOf(rest[key]) === -1) {
        values[key].push(rest[key]);
      }
    });
  });
  return { values, keys: Object.keys(values) };
}

// Strip syntax chars
export const cleanText = s => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();

// const cleanSelectorRegexp = /\{(\w+="[^"\n]*?")(,\w+="[^"\n]*?")*\}/;
const selectorRegexp = /\{[^}]*?\}/;
const labelRegexp = /\b(\w+)(!?=~?)("[^"\n]*?")/g;
export function parseSelector(query: string, cursorOffset = 1): { labelKeys: any[]; selector: string } {
  if (!query.match(selectorRegexp)) {
    // Special matcher for metrics
    if (query.match(/^[A-Za-z:][\w:]*$/)) {
      return {
        selector: `{__name__="${query}"}`,
        labelKeys: ['__name__'],
      };
    }
    throw new Error('Query must contain a selector: ' + query);
  }

  // Check if inside a selector
  const prefix = query.slice(0, cursorOffset);
  const prefixOpen = prefix.lastIndexOf('{');
  const prefixClose = prefix.lastIndexOf('}');
  if (prefixOpen === -1) {
    throw new Error('Not inside selector, missing open brace: ' + prefix);
  }
  if (prefixClose > -1 && prefixClose > prefixOpen) {
    throw new Error('Not inside selector, previous selector already closed: ' + prefix);
  }
  const suffix = query.slice(cursorOffset);
  const suffixCloseIndex = suffix.indexOf('}');
  const suffixClose = suffixCloseIndex + cursorOffset;
  const suffixOpenIndex = suffix.indexOf('{');
  const suffixOpen = suffixOpenIndex + cursorOffset;
  if (suffixClose === -1) {
    throw new Error('Not inside selector, missing closing brace in suffix: ' + suffix);
  }
  if (suffixOpenIndex > -1 && suffixOpen < suffixClose) {
    throw new Error('Not inside selector, next selector opens before this one closed: ' + suffix);
  }

  // Extract clean labels to form clean selector, incomplete labels are dropped
  const selector = query.slice(prefixOpen, suffixClose);
  const labels = {};
  selector.replace(labelRegexp, (_, key, operator, value) => {
    labels[key] = { value, operator };
    return '';
  });

  // Add metric if there is one before the selector
  const metricPrefix = query.slice(0, prefixOpen);
  const metricMatch = metricPrefix.match(/[A-Za-z:][\w:]*$/);
  if (metricMatch) {
    labels['__name__'] = { value: `"${metricMatch[0]}"`, operator: '=' };
  }

  // Build sorted selector
  const labelKeys = Object.keys(labels).sort();
  const cleanSelector = labelKeys.map(key => `${key}${labels[key].operator}${labels[key].value}`).join(',');

  const selectorString = ['{', cleanSelector, '}'].join('');

  return { labelKeys, selector: selectorString };
}
