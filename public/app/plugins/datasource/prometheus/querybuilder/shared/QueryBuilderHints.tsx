import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';

import { GrafanaTheme2, PanelData, QueryHint } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';
import { LokiDatasource } from 'app/plugins/datasource/loki/datasource';

import { PrometheusDatasource } from '../../datasource';

import { LokiAndPromQueryModellerBase, PromLokiVisualQuery } from './LokiAndPromQueryModellerBase';

export interface Props<T extends PromLokiVisualQuery> {
  query: T;
  datasource: PrometheusDatasource | LokiDatasource;
  queryModeller: LokiAndPromQueryModellerBase;
  buildVisualQueryFromString: (expr: string) => { query: T };
  onChange: (update: T) => void;
  data?: PanelData;
}

export const QueryBuilderHints = <T extends PromLokiVisualQuery>({
  datasource,
  query: visualQuery,
  onChange,
  data,
  queryModeller,
  buildVisualQueryFromString,
}: Props<T>) => {
  const [hints, setHints] = useState<QueryHint[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const query = { expr: queryModeller.renderQuery(visualQuery), refId: '' };
    // For now show only actionable hints
    const hints = datasource.getQueryHints(query, data?.series || []).filter((hint) => hint.fix?.action);
    setHints(hints);
  }, [datasource, visualQuery, data, queryModeller]);

  return (
    <>
      {hints.length > 0 && (
        <div className={styles.container}>
          {hints.map((hint) => {
            return (
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
                  hint: {hint.fix?.title || hint.fix?.action?.type.toLowerCase().replace('_', ' ')}
                </Button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </>
  );
};

QueryBuilderHints.displayName = 'QueryBuilderHints';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      align-items: start;
    `,
    hint: css`
      margin-right: ${theme.spacing(1)};
    `,
  };
};
