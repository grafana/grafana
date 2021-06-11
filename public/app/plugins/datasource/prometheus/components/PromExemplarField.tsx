import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, InlineLabel, Tooltip, useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { PrometheusDatasource } from '../datasource';

interface Props {
  isEnabled: boolean;
  onChange: (isEnabled: boolean) => void;
  datasource: PrometheusDatasource;
}

export function PromExemplarField({ datasource, onChange, isEnabled }: Props) {
  const [error, setError] = useState<string>();
  const styles = useStyles2(getStyles);

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

function getStyles(theme: GrafanaTheme2) {
  return {
    eyeIcon: css`
      margin-left: ${theme.spacing(2)};
    `,
    activeIcon: css`
      color: ${theme.colors.primary.main};
    `,
    iconWrapper: css`
      display: flex;
      align-items: center;
    `,
  };
}
