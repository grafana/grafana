import { isObject } from 'lodash';

import { t } from '@grafana/i18n';

export function errorMessage(err: unknown): string {
  if (isObject(err)) {
    if ('data' in err && isObject(err.data) && 'message' in err.data && typeof err.data.message === 'string') {
      return err.data.message;
    }
    if ('message' in err && typeof err.message === 'string') {
      return err.message;
    }
  }
  return t('personal-access-tokens.unknown-error', 'Unexpected error');
}
