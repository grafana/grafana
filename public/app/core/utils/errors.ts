import { isFetchError } from '@grafana/runtime';

export function getMessageFromError(err: unknown): string {
  if (err) {
    if (typeof err === 'string') {
      return err;
    } else if (err instanceof Error) {
      return err.message;
    } else if (isFetchError(err)) {
      if (err.data && err.data.message) {
        return err.data.message;
      } else if (err.statusText) {
        return err.statusText;
      }
    }
  }
  return JSON.stringify(err);
}
