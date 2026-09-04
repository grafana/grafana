import { type FetchError, isFetchError } from '@grafana/runtime';

let expectedNavigationAbort = false;

export function markExpectedNavigationAbort() {
  expectedNavigationAbort = true;
}

export function clearExpectedNavigationAbort() {
  expectedNavigationAbort = false;
}

function readErrorMessage(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const value = err as { message?: unknown; data?: { message?: unknown }; statusText?: unknown };
    if (typeof value.message === 'string' && value.message) {
      return value.message;
    }
    if (typeof value.data?.message === 'string') {
      return value.data.message;
    }
    if (typeof value.statusText === 'string') {
      return value.statusText;
    }
  }
  return '';
}

// Explicit cancels are always ignorable. Firefox/Safari also use generic fetch
// TypeError messages for offline/CORS failures, so those strings are only
// ignored while a full-page navigation (org switch) is in progress.
export function isIgnorableFetchAbort(err: unknown): boolean {
  if (err == null) {
    return false;
  }

  if (typeof err === 'object') {
    const value = err as { name?: string; cancelled?: boolean; type?: unknown; status?: number; statusText?: string };
    if (value.cancelled === true) {
      return true;
    }
    if (value.name === 'AbortError') {
      return true;
    }
    if (value.type === 'cancelled') {
      return true;
    }
    if (value.status === -1 && value.statusText === 'Request was aborted') {
      return true;
    }
  }

  if (!expectedNavigationAbort) {
    return false;
  }

  const message = readErrorMessage(err);
  return (
    message === 'NetworkError when attempting to fetch resource.' ||
    message === 'Load failed' ||
    message === 'The operation was aborted.' ||
    message === 'The operation was aborted'
  );
}

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
