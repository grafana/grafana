import { last } from 'lodash';

import { GraphiteParserError } from './types';

/**
 * Graphite-web before v1.6 returns HTTP 500 with full stack traces in an HTML page
 * when a query fails. It results in massive error alerts with HTML tags in the UI.
 * This function removes all HTML tags and keeps only the last line from the stack
 * trace which should be the most meaningful.
 */
export function reduceError(error: any) {
  if (error && error.status === 500 && error.data?.message?.startsWith('<body')) {
    // Remove all HTML tags and take the last line from the stack trace
    const newMessage = last<string>(
      error.data.message
        .replace(/(<([^>]+)>)/gi, '')
        .trim()
        .split(/\n/)
    )!.replace(/u?&#[^;]+;/g, '');
    error.data.message = `Graphite encountered an unexpected error while handling your request. ${newMessage}`;
  }
  return error;
}

export function isGraphiteParserError(e: unknown): e is GraphiteParserError {
  return typeof e === 'object' && e !== null && 'message' in e && 'pos' in e;
}

export const arrayMove = <T>(array: T[], fromIndex: number, toIndex: number): T[] => {
  array.splice(toIndex, 0, array.splice(fromIndex, 1)[0]);
  return array;
};
