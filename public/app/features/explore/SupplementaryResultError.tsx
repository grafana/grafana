import React, { useState } from 'react';

import { DataQueryError } from '@grafana/data';
import { Alert, Button } from '@grafana/ui';

type Props = {
  error?: DataQueryError;
  title: string;
  suggestion?: string;
  onSuggestionClicked?(): void;
};
export function SupplementaryResultError(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const SHORT_ERROR_MESSAGE_LIMIT = 100;
  const { error, title, suggestion, onSuggestionClicked } = props;
  // generic get-error-message-logic, taken from
  // /public/app/features/explore/ErrorContainer.tsx
  const message = error?.message || error?.data?.message || '';
  const showButton = !isOpen && message.length > SHORT_ERROR_MESSAGE_LIMIT;

  return (
    <Alert title={title} severity="warning">
      {showButton && message ? (
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
      {suggestion && onSuggestionClicked && (
        <Button
          variant="primary"
          size="xs"
          onClick={() => {
            onSuggestionClicked();
          }}
        >
          {suggestion}
        </Button>
      )}
    </Alert>
  );
}
