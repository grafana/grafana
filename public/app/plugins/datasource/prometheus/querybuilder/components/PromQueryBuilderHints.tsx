import React, { useState, useEffect } from 'react';
import { PromVisualQuery } from '../types';
import { PrometheusDatasource } from '../../datasource';
import { promQueryModeller } from '../PromQueryModeller';
import { GrafanaTheme2, PanelData, QueryHint } from '@grafana/data';
import { buildVisualQueryFromString } from '../parsing';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

export interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  data?: PanelData;
}

export const PromQueryBuilderHints = React.memo<Props>(({ datasource, query, onChange, data }) => {
  const [hints, setHints] = useState<QueryHint[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const promQuery = { expr: promQueryModeller.renderQuery(query), refId: '' };
    // For now show only actionable hints
    const hints = datasource.getQueryHints(promQuery, data?.series || []).filter((hint) => hint.fix?.action);
    setHints(hints);
  }, [datasource, query, onChange, data, styles.hint]);

  return (
    <>
      {hints.length > 0 && (
        <div className={styles.container}>
          {hints.map((hint) => {
            return (
              <Tooltip content={`${hint.label} ${hint.fix?.label}`} key={hint.type}>
                <Button
                  onClick={() => {
                    const promQuery = { expr: promQueryModeller.renderQuery(query), refId: '' };
                    const newPromQuery = datasource.modifyQuery(promQuery, hint!.fix!.action);
                    const visualQuery = buildVisualQueryFromString(newPromQuery.expr);
                    return onChange(visualQuery.query);
                  }}
                  fill="outline"
                  size="sm"
                  className={styles.hint}
                >
                  {'hint: ' + hint.fix?.action?.type.toLowerCase().replace('_', ' ') + '()'}
                </Button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </>
  );
});

PromQueryBuilderHints.displayName = 'PromQueryBuilderHints';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      margin-bottom: ${theme.spacing(1)};
      align-items: center;
    `,
    hint: css`
      margin-right: ${theme.spacing(1)};
    `,
  };
};
