export * from './string';
export * from './markdown';
export * from './text';
import { escapeHtml, hasAnsiCodes, sanitize, sanitizeUrl, sanitizeAngularInterpolation } from './sanitize';

export const textUtil = {
  escapeHtml,
  hasAnsiCodes,
  sanitize,
  sanitizeUrl,
  sanitizeAngularInterpolation,
};
