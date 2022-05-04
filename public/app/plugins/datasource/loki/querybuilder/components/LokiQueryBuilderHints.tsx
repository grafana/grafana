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
    const expr = lokiQueryModeller.renderQuery(query);

    const getHints = async () => {
      const labelsQuery = {
        labels: query.labels,
        operations: [],
      };
      const logs = await datasource.getLogSamples(lokiQueryModeller.renderQuery(labelsQuery));
      const hints = datasource.getQueryHints({ expr, refId: '' }, logs).filter((hint) => hint.fix?.action);
      setHints(hints);
    };

    getHints().catch((err) => console.error(err));

    // setHints(hints);
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
