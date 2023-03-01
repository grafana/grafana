import { css } from '@emotion/css';
import React, { ReactElement } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Spinner, useStyles2 } from '@grafana/ui';

import { DiffGroup } from '../VersionHistory/DiffGroup';
import { DiffViewer } from '../VersionHistory/DiffViewer';
import { Diffs } from '../VersionHistory/utils';

interface SaveDashboardDiffProps {
  oldValue?: unknown;
  newValue?: unknown;

  // calculated by parent so we can see summary in tabs
  diff?: Diffs;
}

export const SaveDashboardDiff = ({ diff, oldValue, newValue }: SaveDashboardDiffProps) => {
  const styles = useStyles2(getStyles);
  const loader = useAsync(async () => {
    const oldJSON = JSON.stringify(oldValue ?? {}, null, 2);
    const newJSON = JSON.stringify(newValue ?? {}, null, 2);

    // Schema changes will have MANY changes that the user will not understand
    let schemaChange: ReactElement | undefined = undefined;
    const diffs: ReactElement[] = [];
    let count = 0;
    if (diff) {
      for (const [key, changes] of Object.entries(diff)) {
        // this takes a long time for large diffs (so this is async)
        const g = <DiffGroup diffs={changes} key={key} title={key} />;
        if (key === 'schemaVersion') {
          schemaChange = g;
        } else {
          diffs.push(g);
        }
        count += changes.length;
      }
    }
    return {
      schemaChange,
      diffs,
      count,
      showDiffs: count < 15, // overwhelming if too many changes
      jsonView: <DiffViewer oldValue={oldJSON} newValue={newJSON} />,
    };
  }, [diff, oldValue, newValue]);

  const { value } = loader;
  if (!value || !oldValue) {
    return <Spinner />;
  }

  if (value.count < 1) {
    return <div>No changes in this dashboard</div>;
  }

  return (
    <div>
      {value.schemaChange && <div className={styles.spacer}>{value.schemaChange}</div>}

      {value.showDiffs && <div className={styles.spacer}>{value.diffs}</div>}

      <h4>JSON Model</h4>
      {value.jsonView}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  spacer: css`
    margin-bottom: ${theme.v1.spacing.xl};
  `,
});
