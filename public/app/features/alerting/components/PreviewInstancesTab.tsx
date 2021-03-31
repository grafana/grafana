import React, { FC } from 'react';
import { DataFrame } from '@grafana/data';
import { Button, Table } from '@grafana/ui';
import { EmptyState } from './EmptyState';

interface Props {
  instances: DataFrame[];
  width: number;
  height: number;
  onTest: () => void;
}

export const PreviewInstancesTab: FC<Props> = ({ instances, onTest, height, width }) => {
  if (!instances.length) {
    return (
      <EmptyState title="You haven’t tested your alert yet.">
        <div>In order to see your instances, you need to test your alert first.</div>
        <Button onClick={onTest}>Test alert now</Button>
      </EmptyState>
    );
  }
  return <Table data={instances[0]} height={height} width={width} />;
};
