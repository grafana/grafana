// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/QueryBuilderHints.tsx
import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, PanelData, QueryHint } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { PromQueryModellerInterface, PromVisualQuery } from '../types';

interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  queryModeller: PromQueryModellerInterface;
  buildVisualQueryFromString: (expr: string) => { query: PromVisualQuery };
  onChange: (update: PromVisualQuery) => void;
  data?: PanelData;
}

export const QueryBuilderHints = ({
  datasource,
  query: visualQuery,
  onChange,
  data,
  queryModeller,
  buildVisualQueryFromString,
}: Props) => {
  const [hints, setHints] = useState<QueryHint[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const query = { expr: queryModeller.renderQuery(visualQuery), refId: '' };
    // For now show only actionable hints
    const hints = datasource.getQueryHints(query, data?.series || []).filter((hint) => hint.fix?.action);
    setHints(hints);
  }, [datasource, visualQuery, data, queryModeller]);

  return (
    <div className={styles.root}>
      {hints.length > 0 && (
        <div className={styles.container}>
          {hints.map((hint) => {
            return (
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              <Tooltip content={`${hint.label} ${hint.fix?.label}`} key={hint.type}>
                <Button
                  onClick={() => {
                    reportInteraction('grafana_query_builder_hints_clicked', {
                      hint: hint.type,
                      datasourceType: datasource.type,
                    });

                    if (hint?.fix?.action) {
                      const query = { expr: queryModeller.renderQuery(visualQuery), refId: '' };
                      const newQuery = datasource.modifyQuery(query, hint.fix.action);
                      const newVisualQuery = buildVisualQueryFromString(newQuery.expr);
                      return onChange(newVisualQuery.query);
                    }
                  }}
                  fill="outline"
                  size="sm"
                  className={styles.hint}
                >
                  <Trans
                    i18nKey="grafana-prometheus.querybuilder.query-builder-hints.hint-details"
                    values={{ hintDetails: hint.fix?.title || hint.fix?.action?.type.toLowerCase().replace('_', ' ') }}
                  >
                    hint: {'{{hintDetails}}'}
                  </Trans>
                </Button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
};

QueryBuilderHints.displayName = 'QueryBuilderHints';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    root: css({
      padding: theme.spacing(0.5),
    }),
    container: css({
      display: 'flex',
      alignItems: 'start',
    }),
    hint: css({
      marginRight: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
  };
};
