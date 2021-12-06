import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import Stack from 'app/plugins/datasource/cloudwatch/components/ui/Stack';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { PromVisualQuery, PromVisualQueryBinary } from '../types';
import { BinaryQuery } from './BinaryQuery';

export interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (query: PromVisualQuery) => void;
}

export function BinaryQueryList({ query, datasource, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const binaryQueries = query.binaryQueries ?? [];

  const onBinaryQueryUpdated = (index: number, update: PromVisualQueryBinary) => {
    const updatedList = [...binaryQueries];
    updatedList.splice(index, 1, update);
    onChange({ ...query, binaryQueries: updatedList });
  };

  const onRemove = (index: number) => {
    const updatedList = [...binaryQueries.slice(0, index), ...binaryQueries.slice(index + 1)];
    onChange({ ...query, binaryQueries: updatedList });
  };

  return (
    <div className={styles.body}>
      <Stack gap={1} direction="column">
        <h5 className={styles.heading}></h5>
        <Stack gap={1} direction="column">
          {binaryQueries.map((binaryQuery, index) => (
            <BinaryQuery
              key={index.toString()}
              nestedQuery={binaryQuery}
              index={index}
              onChange={onBinaryQueryUpdated}
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
