import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';

import { GrafanaTheme2, PanelData, QueryHint } from '@grafana/data';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';

import { LokiDatasource } from '../../datasource';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiVisualQuery } from '../types';

export interface Props {
  query: LokiVisualQuery;
  datasource: LokiDatasource;
  onChange: (update: LokiVisualQuery) => void;
  data?: PanelData;
}

export const LokiQueryBuilderHints = React.memo<Props>(({ datasource, query, onChange, data }) => {
  const [hints, setHints] = useState<QueryHint[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const lokiQuery = { expr: lokiQueryModeller.renderQuery(query), refId: 'data-samples' };
    if (data?.series.length) {
      const hints = datasource.getQueryHints(lokiQuery, data?.series ?? []).filter((hint) => hint.fix?.action);
      setHints(hints);
    }
  }, [datasource, query, data]);

  return (
    <>
      {hints.length > 0 && (
        <div className={styles.container}>
          {hints.map((hint) => {
            return (
              <Tooltip content={`${hint.label} ${hint.fix?.label}`} key={hint.type}>
                <Button
                  onClick={() => {
                    const lokiQuery = { expr: lokiQueryModeller.renderQuery(query), refId: '' };
                    const newLokiQuery = datasource.modifyQuery(lokiQuery, hint!.fix!.action);
                    const visualQuery = buildVisualQueryFromString(newLokiQuery.expr);
                    return onChange(visualQuery.query);
                  }}
                  fill="outline"
                  size="sm"
                  className={styles.hint}
                >
                  {'hint: ' + hint.fix?.action?.type.toLowerCase().replace(/_/g, ' ')}
                </Button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </>
  );
});

LokiQueryBuilderHints.displayName = 'LokiQueryBuilderHints';

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
