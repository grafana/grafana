import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Alert } from '@grafana/ui';
import { TestingStatus } from 'app/types';

export type Props = {
  testingStatus?: TestingStatus;
};

export function DataSourceTestingStatus({ testingStatus }: Props) {
  const isError = testingStatus?.status === 'error';
  const message = testingStatus?.message;
  const detailsMessage = testingStatus?.details?.message;
  const detailsVerboseMessage = testingStatus?.details?.verboseMessage;

  if (message) {
    return (
      <div className="gf-form-group p-t-2">
        <Alert
          severity={isError ? 'error' : 'success'}
          title={message}
          aria-label={e2eSelectors.pages.DataSource.alert}
        >
          {testingStatus?.details && (
            <>
              {detailsMessage}
              {detailsVerboseMessage ? (
                <details style={{ whiteSpace: 'pre-wrap' }}>{detailsVerboseMessage}</details>
              ) : null}
            </>
          )}
        </Alert>
      </div>
    );
  }

  return null;
}
