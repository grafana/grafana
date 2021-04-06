import { GrafanaTheme } from '@grafana/data';
import { IconButton, InlineLabel, Tooltip, useStyles } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { useEffect, useState } from 'react';
import { PrometheusDatasource } from '../datasource';

interface Props {
  isEnabled: boolean;
  onChange: (isEnabled: boolean) => void;
  datasource: PrometheusDatasource;
}

export function PromExemplarField({ datasource, onChange, isEnabled }: Props) {
  const [error, setError] = useState<string>();
  const styles = useStyles(getStyles);

  useEffect(() => {
    const subscription = datasource.exemplarErrors.subscribe((err) => {
      setError(err);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [datasource]);

  const iconButtonStyles = cx(
    {
      [styles.activeIcon]: isEnabled,
    },
    styles.eyeIcon
  );

  return (
    <InlineLabel width="auto">
      <Tooltip content={error ?? ''}>
        <div className={styles.iconWrapper}>
          Exemplars
          <IconButton
            name="eye"
            tooltip={isEnabled ? 'Disable query with exemplars' : 'Enable query with exemplars'}
            disabled={!!error}
            className={iconButtonStyles}
            onClick={() => {
              onChange(!isEnabled);
            }}
          />
        </div>
      </Tooltip>
    </InlineLabel>
  );
}

function getStyles(theme: GrafanaTheme) {
  return {
    eyeIcon: css`
      margin-left: ${theme.spacing.md};
    `,
    activeIcon: css`
      color: ${theme.palette.blue95};
    `,
    iconWrapper: css`
      display: flex;
      align-items: center;
    `,
  };
}
