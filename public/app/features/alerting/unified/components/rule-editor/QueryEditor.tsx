import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PanelData, DataSourceInstanceSettings } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryRows } from './QueryRows';

interface Props {
  panelData: Record<string, PanelData>;
  queries: AlertQuery[];
  expressions: AlertQuery[];
  onRunQueries: () => void;
  onChangeQueries: (queries: AlertQuery[]) => void;
  onDuplicateQuery: (query: AlertQuery) => void;
  condition: string | null;
  onSetCondition: (refId: string) => void;
  filter?: (ds: DataSourceInstanceSettings) => boolean;
  renderHeaderExtras?: boolean;
  renderActions?: boolean;
}

export const QueryEditor = ({
  queries,
  expressions,
  panelData,
  onRunQueries,
  onChangeQueries,
  onDuplicateQuery,
  condition,
  onSetCondition,
  filter,
  renderHeaderExtras,
  renderActions,
}: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <QueryRows
        data={panelData}
        queries={queries}
        expressions={expressions}
        onRunQueries={onRunQueries}
        onQueriesChange={onChangeQueries}
        onDuplicateQuery={onDuplicateQuery}
        condition={condition}
        onSetCondition={onSetCondition}
        filter={filter}
        renderHeaderExtras={renderHeaderExtras}
        renderActions={renderActions}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    background-color: ${theme.colors.background.primary};
    height: 100%;
    max-width: ${theme.breakpoints.values.xxl}px;
  `,
});
