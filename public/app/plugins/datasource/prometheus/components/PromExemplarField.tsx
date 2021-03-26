import { GrafanaTheme } from '@grafana/data';
import { FetchError } from '@grafana/runtime';
import { IconButton, InlineLabel, Tooltip, useStyles } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { useEffect, useState } from 'react';
import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

interface Props {
  query: PromQuery;
  onChange: (value: PromQuery) => void;
  datasource: PrometheusDatasource;
}

export function PromExemplarField(props: Props) {
  const [error, setError] = useState<FetchError>();
  const styles = useStyles(getStyles);

  useEffect(() => {
    const subscription = props.datasource.exemplarErrors.subscribe((err) => {
      setError(err);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [props]);

  const iconButtonStyles = cx(
    {
      [styles.activeIcon]: !!props.query.exemplar,
    },
    styles.eyeIcon
  );

  return (
    <InlineLabel width="auto">
      <Tooltip content={!!error ? 'Exemplars are not supported in this version of prometheus.' : ''}>
        <div className={styles.iconWrapper}>
          Exemplars
          <IconButton
            name="eye"
            tooltip={!!props.query.exemplar ? 'Disable query with exemplars' : 'Enable query with exemplars'}
            disabled={!!error}
            className={iconButtonStyles}
            onClick={() => {
              props.onChange({ ...props.query, exemplar: !props.query.exemplar });
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
