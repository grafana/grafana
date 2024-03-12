import { css } from '@emotion/css';
import React, { HTMLAttributes } from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, AlertVariant, Button, HorizontalGroup, Tooltip, useTheme2 } from '@grafana/ui';
import { getIconFromSeverity } from '@grafana/ui/src/components/Alert/Alert';

type Justify = 'flex-start' | 'flex-end' | 'space-between' | 'center';

interface CollapsibleAlertProps extends HTMLAttributes<HTMLDivElement> {
  localStoreKey: string;
  startClosed?: boolean;
  severity?: AlertVariant;
  collapseText?: string;
  collapseTooltip: string;
  collapseJustify?: Justify;
  alertTitle: string;
  children?: React.ReactNode;
}

export const CollapsibleAlert = ({
  localStoreKey,
  startClosed = false,
  severity = 'error',
  collapseText,
  collapseTooltip,
  collapseJustify = 'flex-end',
  alertTitle,
  children,
}: CollapsibleAlertProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme, severity);
  const [closed, setClosed] = useLocalStorage(localStoreKey, startClosed);

  return (
    <>
      {closed && (
        <HorizontalGroup justify={collapseJustify}>
          <Tooltip content={collapseTooltip} placement="bottom">
            <Button
              fill="text"
              variant="secondary"
              icon={getIconFromSeverity(severity)}
              className={styles.warningButton}
              onClick={() => setClosed(false)}
            >
              {collapseText}
            </Button>
          </Tooltip>
        </HorizontalGroup>
      )}
      {!closed && (
        <Alert severity={severity} title={alertTitle} onRemove={() => setClosed(true)}>
          {children}
        </Alert>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2, severity: AlertVariant) => {
  const color = theme.colors[severity];
  return {
    warningButton: css({
      color: color.text,

      '&:hover': {
        background: color.transparent,
      },
    }),
  };
};
