import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { StatusInfo } from '../../types';

export function BulkActionError({ error }: { error?: string | StatusInfo }) {
  if (!error) {
    return null;
  }

  if (typeof error === 'string') {
    return <Alert title={t('bulk-action-error.title-default', 'Error')}>{error}</Alert>;
  }

  return (
    <Alert
      title={
        t('bulk-action-error.title', '{{title}}', { title: error?.title }) ||
        t('bulk-action-error.title-default', 'Error')
      }
    >
      {typeof error?.message === 'string' ? (
        <p>{error?.message}</p>
      ) : (
        <ul>
          {error?.message?.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
