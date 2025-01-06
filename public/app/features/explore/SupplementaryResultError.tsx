import { css } from '@emotion/css';
import { ReactNode, useCallback, useState } from 'react';

import { DataQueryError, GrafanaTheme2 } from '@grafana/data';
import { Alert, AlertVariant, Button, useTheme2 } from '@grafana/ui';

type Props = {
  error?: DataQueryError;
  message?: ReactNode;
  title: string;
  severity?: AlertVariant;
  suggestedAction?: string;
  onSuggestedAction?(): void;
  onRemove?(): void;
  dismissable?: boolean;
};
const SHORT_ERROR_MESSAGE_LIMIT = 100;
export function SupplementaryResultError(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { dismissable, error, title, suggestedAction, onSuggestedAction, onRemove, severity = 'warning' } = props;
  // generic get-error-message-logic, taken from
  // /public/app/features/explore/ErrorContainer.tsx
  const message = props.message ?? error?.message ?? error?.data?.message ?? '';
  const showButton = typeof message === 'string' && message.length > SHORT_ERROR_MESSAGE_LIMIT;
  const theme = useTheme2();
  const styles = getStyles(theme);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const handleRemove = dismissable ? dismiss : onRemove;

  if (dismissed) {
    return null;
  }

  return (
    <div className={styles.supplementaryErrorContainer}>
      <Alert title={title} severity={severity} onRemove={handleRemove}>
        {showButton ? (
          <div className={styles.messageWrapper}>
            {!isOpen ? (
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
          </div>
        ) : (
          <div className={`${styles.messageWrapper} ${styles.suggestedActionWrapper}`}>
            {message}
            {suggestedAction && onSuggestedAction && (
              <Button variant="primary" size="xs" onClick={onSuggestedAction}>
                {suggestedAction}
              </Button>
            )}
          </div>
        )}
      </Alert>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    supplementaryErrorContainer: css({
      width: '60%',
      minWidth: `${theme.breakpoints.values.sm}px`,
      maxWidth: `${theme.breakpoints.values.md}px`,
      margin: '0 auto',
    }),
    messageWrapper: css({
      minHeight: theme.spacing(3),
      ['ul']: {
        paddingLeft: theme.spacing(2),
      },
      ['button']: {
        position: 'absolute',
        bottom: theme.spacing(2),
        right: theme.spacing(2),
      },
    }),
    suggestedActionWrapper: css({
      paddingBottom: theme.spacing(5),
    }),
  };
};
