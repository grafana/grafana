export * from './string';
export * from './markdown';
export * from './text';
import {
  escapeHtml,
  hasAnsiCodes,
  sanitize,
  sanitizeUrl,
  sanitizeTextPanelContent,
  sanitizeSVGContent,
} from './sanitize';

export const textUtil = {
  escapeHtml,
  hasAnsiCodes,
  sanitize,
  sanitizeTextPanelContent,
  sanitizeUrl,
  sanitizeSVGContent,
};
