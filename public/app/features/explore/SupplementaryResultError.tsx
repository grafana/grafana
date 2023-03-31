import { css } from '@emotion/css';
import React, { useState } from 'react';

import { DataQueryError, GrafanaTheme2 } from '@grafana/data';
import { Alert, AlertVariant, Button, useTheme2 } from '@grafana/ui';

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
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.supplementaryErrorContainer}>
      <Alert title={title} severity={severity} onRemove={onRemove}>
        <div className={styles.suggestedActionWrapper}>
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
            <div className={styles.suggestedActionWrapper}>
              <Button variant="primary" size="xs" onClick={onSuggestedAction}>
                {suggestedAction}
              </Button>
            </div>
          )}
        </div>
      </Alert>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    supplementaryErrorContainer: css`
      width: 50%;
      margin: 0 auto;
    `,
    suggestedActionWrapper: css`
      height: ${theme.spacing(6)};
      button {
        position: absolute;
        right: ${theme.spacing(2)};
        top: ${theme.spacing(7)};
      }
    `,
  };
};
