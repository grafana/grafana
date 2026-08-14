import { isFetchError } from '@grafana/runtime';

// TODO: candidate to hoist and share
export function maybeAPIError(err: unknown) {
  if (!isFetchError<unknown>(err) || typeof err.data !== 'object' || !err.data) {
    return null;
  }

  const data = err?.data;
  const message = 'message' in data && typeof data.message === 'string' ? data.message : null;
  const messageId = 'messageId' in data && typeof data.messageId === 'string' ? data.messageId : null;
  const statusCode = 'statusCode' in data && typeof data.statusCode === 'number' ? data.statusCode : null;

  if (!message || !messageId || !statusCode) {
    return null;
  }

  return { message, messageId, statusCode };
}
