import React, { FC } from 'react';
import { DataFrame } from '@grafana/data';
import { Button, Table } from '@grafana/ui';
import { PreviewStyles } from './AlertingQueryPreview';

interface Props {
  instances: DataFrame[];
  isTested: boolean;
  styles: PreviewStyles;
  width: number;
  height: number;
  onTest: () => void;
}

export const PreviewInstancesTab: FC<Props> = ({ instances, isTested, onTest, height, styles, width }) => {
  if (!isTested) {
    return (
      <div className={styles.noQueries}>
        <h4 className={styles.noQueriesHeader}>You haven’t tested your alert yet.</h4>
        <div>In order to see your instances, you need to test your alert first.</div>
        <Button onClick={onTest}>Test alert now</Button>
      </div>
    );
  }
  return <Table data={instances[0]} height={height} width={width} />;
};
