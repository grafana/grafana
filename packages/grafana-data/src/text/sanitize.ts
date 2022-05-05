import { sanitizeUrl as braintreeSanitizeUrl } from '@braintree/sanitize-url';
import * as xss from 'xss';

const XSSWL = Object.keys(xss.whiteList).reduce((acc, element) => {
  acc[element] = xss.whiteList[element]?.concat(['class', 'style']);
  return acc;
}, {} as xss.IWhiteList);

const sanitizeXSS = new xss.FilterXSS({
  whiteList: XSSWL,
});

const sanitizeTextPanelWhitelist = new xss.FilterXSS({
  whiteList: XSSWL,
  css: {
    whiteList: {
      ...xss.getDefaultCSSWhiteList(),
      'flex-direction': true,
      'flex-wrap': true,
      'flex-basis': true,
      'flex-grow': true,
      'flex-shrink': true,
      'flex-flow': true,
      gap: true,
      order: true,
      'justify-content': true,
      'justify-items': true,
      'justify-self': true,
      'align-items': true,
      'align-content': true,
      'align-self': true,
    },
  },
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
    console.error('String could not be sanitized', unsanitizedString);
    return unsanitizedString;
  }
}

export function sanitizeTextPanelContent(unsanitizedString: string): string {
  try {
    return sanitizeTextPanelWhitelist.process(unsanitizedString);
  } catch (error) {
    console.error('String could not be sanitized', unsanitizedString);
    return 'Text string could not be sanitized';
  }
}

export function sanitizeUrl(url: string): string {
  return braintreeSanitizeUrl(url);
}

export function hasAnsiCodes(input: string): boolean {
  return /\u001b\[\d{1,2}m/.test(input);
}

export function escapeHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
