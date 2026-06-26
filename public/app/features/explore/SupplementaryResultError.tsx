import { css } from '@emotion/css';
import { ReactNode, useState } from 'react';

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
};
const SHORT_ERROR_MESSAGE_LIMIT = 100;
export function SupplementaryResultError(props: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const { error, title, suggestedAction, onSuggestedAction, onRemove, severity = 'warning' } = props;
  // generic get-error-message-logic, taken from
  // /public/app/features/explore/ErrorContainer.tsx
  const message = props.message ?? error?.message ?? error?.data?.message ?? '';
  const showButton = typeof message === 'string' && message.length > SHORT_ERROR_MESSAGE_LIMIT;
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.supplementaryErrorContainer}>
      <Alert title={title} severity={severity} onRemove={onRemove}>
        {showButton ? (
          <div className={styles.suggestedActionWrapper}>
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
          <div className={styles.suggestedActionWrapper}>
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
      width: '50%',
      minWidth: `${theme.breakpoints.values.sm}px`,
      margin: '0 auto',
      [theme.breakpoints.down('lg')]: {
        width: '70%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
    }),
    suggestedActionWrapper: css({
      minHeight: theme.spacing(3),
      ['button']: {
        position: 'absolute',
        right: theme.spacing(2),
        bottom: theme.spacing(2),
      },
      ['ul']: {
        paddingLeft: theme.spacing(2),
      },
    }),
  };
};
