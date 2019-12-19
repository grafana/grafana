import xss from 'xss';
import { sanitizeUrl as braintreeSanitizeUrl } from '@braintree/sanitize-url';

const XSSWL = Object.keys(xss.whiteList).reduce((acc, element) => {
  // @ts-ignore
  acc[element] = xss.whiteList[element].concat(['class', 'style']);
  return acc;
}, {});

const sanitizeXSS = new xss.FilterXSS({
  whiteList: XSSWL,
});

/**
 * Returns string safe from XSS attacks.
 *
 * Even though we allow the style-attribute, there's still default filtering applied to it
 * Info: https://github.com/leizongmin/js-xss#customize-css-filter
 * Whitelist: https://github.com/leizongmin/js-css-filter/blob/master/lib/default.js
 */
export function sanitize(unsanitizedString: string): string {
  try {
    return sanitizeXSS.process(unsanitizedString);
  } catch (error) {
    console.log('String could not be sanitized', unsanitizedString);
    return unsanitizedString;
  }
}

export function sanitizeUrl(url: string): string {
  return braintreeSanitizeUrl(url);
}

export function hasAnsiCodes(input: string): boolean {
  return /\u001b\[\d{1,2}m/.test(input);
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
