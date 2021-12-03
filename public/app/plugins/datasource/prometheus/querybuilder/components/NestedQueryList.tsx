import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import Stack from 'app/plugins/datasource/cloudwatch/components/ui/Stack';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { PromVisualQuery, PromVisualQueryNested } from '../types';
import { NestedQuery } from './NestedQuery';

export interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (query: PromVisualQuery) => void;
}

export function NestedQueryList({ query, datasource, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const nestedQueries = query.nestedQueries ?? [];

  const onNestedQueryUpdate = (index: number, update: PromVisualQueryNested) => {
    const updatedList = [...nestedQueries];
    updatedList.splice(index, 1, update);
    onChange({ ...query, nestedQueries: updatedList });
  };

  const onRemove = (index: number) => {
    const updatedList = [...nestedQueries.slice(0, index), ...nestedQueries.slice(index + 1)];
    onChange({ ...query, nestedQueries: updatedList });
  };

  return (
    <div className={styles.body}>
      <Stack gap={1} direction="column">
        <h5 className={styles.heading}>Sub queries</h5>
        <Stack gap={1} direction="column">
          {nestedQueries.map((nestedQuery, index) => (
            <NestedQuery
              key={index.toString()}
              nestedQuery={nestedQuery}
              index={index}
              onChange={onNestedQueryUpdate}
              datasource={datasource}
              onRemove={onRemove}
            />
          ))}
        </Stack>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      fontSize: 12,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    body: css({
      width: '100%',
    }),
    connectingLine: css({
      height: '2px',
      width: '16px',
      backgroundColor: theme.colors.border.strong,
      alignSelf: 'center',
    }),
    addOperation: css({
      paddingLeft: theme.spacing(2),
    }),
  };
};
