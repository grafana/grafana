import React, { FC } from 'react';
import { PanelData } from '@grafana/data';
import { Button } from '@grafana/ui';
import { PreviewStyles } from './AlertingQueryPreview';

interface Props {
  data: PanelData;
  isTested: boolean;
  styles: PreviewStyles;
}

export const PreviewInstancesTab: FC<Props> = ({ data, isTested, styles }) => {
  if (!isTested) {
    return (
      <div className={styles.noQueries}>
        <h4 className={styles.noQueriesHeader}>You haven’t tested your alert yet.</h4>
        <div>In order to see your instances, you need to test your alert first.</div>
        <Button>Test alert now</Button>
      </div>
    );
  }
  return <div>Instances</div>;
};
