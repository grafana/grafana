import React, { useState } from 'react';

import { DataQueryError } from '@grafana/data';
import { Alert, AlertVariant, Button } from '@grafana/ui';

type Props = {
  error?: DataQueryError;
  title: string;
  severity?: AlertVariant;
  suggestedAction?: string;
  onSuggestedAction?(): void;
  onRemove?(): void;
};
export function SupplementaryResultError(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const SHORT_ERROR_MESSAGE_LIMIT = 100;
  const { error, title, suggestedAction, onSuggestedAction, onRemove, severity = 'warning' } = props;
  // generic get-error-message-logic, taken from
  // /public/app/features/explore/ErrorContainer.tsx
  const message = error?.message || error?.data?.message || '';
  const showButton = !isOpen && message.length > SHORT_ERROR_MESSAGE_LIMIT;

  return (
    <Alert title={title} severity={severity} onRemove={onRemove}>
      {showButton ? (
        <Button
          variant="secondary"
          size="xs"
          onClick={() => {
            setIsOpen(true);
          }}
        >
          Show details
        </Button>
      ) : (
        message
      )}
      {suggestedAction && onSuggestedAction && (
        <Button variant="primary" size="xs" onClick={onSuggestedAction}>
          {suggestedAction}
        </Button>
      )}
    </Alert>
  );
}
