import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2, HorizontalGroup, IconButton, Tooltip, Icon } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';

import { testIds } from '../../components/LokiQueryEditor';
import { LokiQueryField } from '../../components/LokiQueryField';
import { getStats } from '../../components/stats';
import { LokiQueryEditorProps } from '../../components/types';
import { formatLogqlQuery } from '../../queryUtils';
import { QueryStats } from '../../types';

import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplained';

type Props = LokiQueryEditorProps & {
  showExplain: boolean;
  setQueryStats: React.Dispatch<React.SetStateAction<QueryStats | null>>;
};

export function LokiQueryCodeEditor({
  query,
  datasource,
  range,
  onRunQuery,
  onChange,
  data,
  app,
  showExplain,
  history,
  setQueryStats,
}: Props) {
  const styles = useStyles2(getStyles);

  const lokiFormatQuery = config.featureToggles.lokiFormatQuery;
  const onClickFormatQueryButton = async () => onChange({ ...query, expr: formatLogqlQuery(query.expr, datasource) });

  return (
    <div className={styles.wrapper}>
      <LokiQueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={onRunQuery}
        onChange={onChange}
        history={history}
        data={data}
        app={app}
        data-testid={testIds.editor}
        onQueryType={async (query: string) => {
          const stats = await getStats(datasource, query);
          setQueryStats(stats);
        }}
        ExtraFieldElement={
          <>
            {lokiFormatQuery && (
              <div className={styles.buttonGroup}>
                <div>
                  <HorizontalGroup spacing="sm">
                    <IconButton
                      onClick={onClickFormatQueryButton}
                      name="brackets-curly"
                      size="xs"
                      tooltip="Format query"
                    />
                    <Tooltip content={`Use ${getModKey()}+z to undo`}>
                      <Icon className={styles.hint} name="keyboard" />
                    </Tooltip>
                  </HorizontalGroup>
                </div>
              </div>
            )}
          </>
        }
      />
      {showExplain && <LokiQueryBuilderExplained query={query.expr} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      max-width: 100%;
      .gf-form {
        margin-bottom: 0.5;
      }
    `,
    buttonGroup: css`
      border: 1px solid ${theme.colors.border.medium};
      border-top: none;
      padding: ${theme.spacing(0.5, 0.5, 0.5, 0.5)};
      margin-bottom: ${theme.spacing(0.5)};
      display: flex;
      flex-grow: 1;
      justify-content: end;
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    hint: css`
      color: ${theme.colors.text.disabled};
      white-space: nowrap;
      cursor: help;
    `,
  };
};
