import { FetchError, isFetchError } from '@grafana/runtime';

export function getMessageFromError(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }

  if (err) {
    if (err instanceof Error) {
      return err.message;
    } else if (isFetchError(err)) {
      if (err.data && err.data.message) {
        return err.data.message;
      } else if (err.statusText) {
        return err.statusText;
      }
    } else if (err.hasOwnProperty('message')) {
      // @ts-expect-error
      return err.message;
    }
  }

  return JSON.stringify(err);
}

export function getStatusFromError(err: unknown): number | undefined {
  if (typeof err === 'string') {
    return undefined;
  }

  if (err) {
    if (err instanceof Error) {
      return undefined;
    } else if (isFetchError(err)) {
      return err.status;
    } else if (err.hasOwnProperty('status')) {
      // @ts-expect-error
      return err.status;
    }
  }

  return undefined;
}

export function getMessageIdFromError(err: unknown): string | undefined {
  if (typeof err === 'string') {
    return undefined;
  }

  if (err) {
    if (err instanceof Error) {
      return undefined;
    } else if (isFetchError(err)) {
      return err.data?.messageId;
    } else if (err.hasOwnProperty('messageId')) {
      // @ts-expect-error
      return err.messageId;
    }
  }

  return undefined;
}

export function getRequestConfigFromError(err: FetchError): string {
  const method = err.config?.method ?? 'GET';
  const url = err.config?.url;

  return method && url ? `${method} ${url}` : 'request';
}
