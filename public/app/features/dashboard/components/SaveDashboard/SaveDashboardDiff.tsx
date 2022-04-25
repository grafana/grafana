import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Spinner, useStyles2 } from '@grafana/ui';

import { DiffGroup } from '../VersionHistory/DiffGroup';
import { DiffViewer } from '../VersionHistory/DiffViewer';
import { Diffs } from '../VersionHistory/utils';

interface SaveDashboardDiffProps {
  oldValue?: any;
  newValue?: any;

  // calculated by parent so we can see summary in tabs
  diff?: Diffs;
}

export const SaveDashboardDiff = ({ diff, oldValue, newValue }: SaveDashboardDiffProps) => {
  const styles = useStyles2(getStyles);
  const loader = useAsync(async () => {
    const oldJSON = JSON.stringify(oldValue ?? {}, null, 2);
    const newJSON = JSON.stringify(newValue ?? {}, null, 2);
    return {
      oldJSON,
      newJSON,
      diffs: Object.entries(diff ?? []).map(([key, diffs]) => (
        <DiffGroup diffs={diffs} key={key} title={key} /> // this takes a long time for large diffs
      )),
    };
  }, [diff, oldValue, newValue]);

  const { value } = loader;
  if (!value || !oldValue) {
    return <Spinner />;
  }

  if (!value.diffs.length) {
    return <div>No changes in this dashboard</div>;
  }

  return (
    <div>
      <div className={styles.spacer}>{value.diffs}</div>

      <h4>JSON Diff</h4>
      <DiffViewer oldValue={value.oldJSON} newValue={value.newJSON} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  spacer: css`
    margin-bottom: ${theme.v1.spacing.xl};
  `,
});
