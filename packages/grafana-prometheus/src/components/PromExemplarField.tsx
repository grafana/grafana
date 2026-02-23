// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PromExemplarField.tsx
import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { IconButton, InlineLabel, Tooltip, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

interface Props {
  onChange: (exemplar: boolean) => void;
  datasource: PrometheusDatasource;
  query: PromQuery;
  'data-testid'?: string;
}

export function PromExemplarField({ datasource, onChange, query, ...rest }: Props) {
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles2(getStyles);
  const prevError = usePrevious(error);

  useEffect(() => {
    if (!datasource.exemplarsAvailable) {
      setError('Exemplars for this query are not available');
      onChange(false);
    } else if (query.instant && !query.range) {
      setError('Exemplars are not available for instant queries');
      onChange(false);
    } else {
      setError(null);
      // If error is cleared, we want to change exemplar to true
      if (prevError && !error) {
        onChange(true);
      }
    }
  }, [datasource.exemplarsAvailable, query.instant, query.range, onChange, prevError, error]);

  const iconButtonStyles = cx(
    {
      [styles.activeIcon]: !!query.exemplar,
    },
    styles.eyeIcon
  );

  return (
    <InlineLabel width="auto" data-testid={rest['data-testid']}>
      <Tooltip content={error ?? ''}>
        <div className={styles.iconWrapper}>
          <Trans i18nKey="grafana-prometheus.components.prom-exemplar-field.exemplars">Exemplars</Trans>
          <IconButton
            name="eye"
            tooltip={
              !!query.exemplar
                ? t(
                    'grafana-prometheus.components.prom-exemplar-field.tooltip-disable-query',
                    'Disable query with exemplars'
                  )
                : t(
                    'grafana-prometheus.components.prom-exemplar-field.tooltip-enable-query',
                    'Enable query with exemplars'
                  )
            }
            disabled={!!error}
            className={iconButtonStyles}
            onClick={() => {
              onChange(!query.exemplar);
            }}
          />
        </div>
      </Tooltip>
    </InlineLabel>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    eyeIcon: css({
      marginLeft: theme.spacing(2),
    }),
    activeIcon: css({
      color: theme.colors.primary.main,
    }),
    iconWrapper: css({
      display: 'flex',
      alignItems: 'center',
    }),
  };
}
