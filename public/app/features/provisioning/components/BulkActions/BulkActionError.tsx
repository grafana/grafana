import { Alert } from '@grafana/ui';

import { StatusInfo } from '../../types';

export function BulkActionError({ error }: { error?: string | StatusInfo }) {
  if (!error) {
    return null;
  }
  return (
    <Alert title={error?.title || 'Error'}>
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
