import _ from 'lodash';

export function getMessageFromError(err: any): string | null {
  if (err && !_.isString(err)) {
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
