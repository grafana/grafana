import { sanitizeUrl as braintreeSanitizeUrl } from '@braintree/sanitize-url';
import DOMPurify from 'dompurify';
import * as xss from 'xss';

const XSSWL = Object.keys(xss.whiteList).reduce<xss.IWhiteList>((acc, element) => {
  acc[element] = xss.whiteList[element]?.concat(['class', 'style']);
  return acc;
}, {});

// Add iframe tags to XSSWL.
// We don't allow the sandbox attribute, since it can be overridden, instead we add it below.
XSSWL.iframe = ['src', 'width', 'height'];

const sanitizeTextPanelWhitelist = new xss.FilterXSS({
  // Add sandbox attribute to iframe tags if an attribute is allowed.
  onTagAttr(tag, name, value, isWhiteAttr) {
    if (tag === 'iframe') {
      return isWhiteAttr
        ? ` ${name}="${xss.escapeAttrValue(sanitizeUrl(value))}" sandbox credentialless referrerpolicy=no-referrer`
        : '';
    }
    return;
  },
  onTag(tag, html, options) {
    if (html === '<input disabled="" type="checkbox">' || html === '<input checked="" disabled="" type="checkbox">') {
      return html;
    }
    return;
  },
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
 * Return a sanitized string that is going to be rendered in the browser to prevent XSS attacks.
 * Note that sanitized tags will be removed, such as "<script>".
 * We don't allow form or input elements.
 */
export function sanitize(unsanitizedString: string): string {
  try {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return DOMPurify.sanitize(unsanitizedString, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['form', 'input'],
      ADD_ATTR: ['target'],
    });
  } catch (error) {
    console.error('String could not be sanitized', unsanitizedString);
    return escapeHtml(unsanitizedString);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes');
  }
}

export function sanitizeTrustedTypesRSS(unsanitizedString: string): TrustedHTML {
  return DOMPurify.sanitize(unsanitizedString, {
    RETURN_TRUSTED_TYPE: true,
    ADD_ATTR: ['xmlns:atom', 'version', 'property', 'content'],
    ADD_TAGS: ['rss', 'meta', 'channel', 'title', 'link', 'description', 'atom:link', 'item', 'pubDate', 'guid'],
    PARSER_MEDIA_TYPE: 'application/xhtml+xml',
  });
}

export function sanitizeTrustedTypes(unsanitizedString: string): TrustedHTML {
  return DOMPurify.sanitize(unsanitizedString, { RETURN_TRUSTED_TYPE: true });
}

/**
 * Returns string safe from XSS attacks to be used in the Text panel plugin.
 *
 * Even though we allow the style-attribute, there's still default filtering applied to it
 * Info: https://github.com/leizongmin/js-xss#customize-css-filter
 * Whitelist: https://github.com/leizongmin/js-css-filter/blob/master/lib/default.js
 */
export function sanitizeTextPanelContent(unsanitizedString: string): string {
  try {
    return sanitizeTextPanelWhitelist.process(unsanitizedString);
  } catch (error) {
    console.error('String could not be sanitized', unsanitizedString);
    return 'Text string could not be sanitized';
  }
}

// Returns sanitized SVG, free from XSS attacks to be used when rendering SVG content.
export function sanitizeSVGContent(unsanitizedString: string): string {
  return DOMPurify.sanitize(unsanitizedString, { USE_PROFILES: { svg: true, svgFilters: true } });
}

// Return a sanitized URL, free from XSS attacks, such as javascript:alert(1)
export function sanitizeUrl(url: string): string {
  return braintreeSanitizeUrl(url);
}

// Returns true if the string contains ANSI color codes.
export function hasAnsiCodes(input: string): boolean {
  return /\u001b\[\d{1,2}m/.test(input);
}

// Returns a string with HTML entities escaped.
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

export class PathValidationError extends Error {
  constructor(message = 'Invalid request path') {
    super(message);
    this.name = 'PathValidationError';
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PathValidationError);
    }
  }
}

/**
 * Validates a path or URL, protecting against path traversal attacks.
 * Returns the original input if safe, or throw an error
 */
export function validatePath<OriginalPath extends string>(path: OriginalPath): OriginalPath {
  try {
    let originalDecoded: string = path; // down-cast to a string to indicate this can't be returned
    while (true) {
      const nextDecode = decodeURIComponent(originalDecoded);
      if (nextDecode === originalDecoded) {
        break; // String is fully decoded.
      }
      originalDecoded = nextDecode;
    }

    // Remove query params and fragments to check only the path portion
    const cleaned = originalDecoded.split(/[\?#]/)[0];
    originalDecoded = cleaned;

    // If the original string contains traversal attempts, block it
    if (/\.\.|\/\\|[\t\n\r]/.test(originalDecoded)) {
      throw new PathValidationError();
    }

    return path;
  } catch (err) {
    // Rethrow the original InvalidPathError to preserve the stack trace
    if (err instanceof PathValidationError) {
      throw err;
    }

    // A decoding error can happen with malformed URIs (e.g., % not followed by hex).
    // These are suspicious, so we treat them as traversal attempts.
    throw new PathValidationError('Error validating request path');
  }
}

export const textUtil = {
  escapeHtml,
  hasAnsiCodes,
  sanitize,
  sanitizeTextPanelContent,
  sanitizeUrl,
  sanitizeSVGContent,
  sanitizeTrustedTypes,
  sanitizeTrustedTypesRSS,
};
