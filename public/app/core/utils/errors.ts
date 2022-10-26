import { isString } from 'lodash';

export function getMessageFromError(err: string | (Error & { data?: any; statusText?: string })): string {
  if (err && !isString(err)) {
    if (err.message) {
      return err.message;
    } else if (err.data && err.data.message) {
      return err.data.message;
    } else if (err.statusText) {
      return err.statusText;
    } else {
      return JSON.stringify(err);
    }
  }

  return err;
}
