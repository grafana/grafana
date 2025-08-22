import { ReactElement } from 'react';
import { useAsync } from 'react-use';

import { Box, Icon, Spinner, Stack } from '@grafana/ui';
import { Diffs } from 'app/features/dashboard-scene/settings/version-history/utils';

import { DiffGroup } from '../../../dashboard-scene/settings/version-history/DiffGroup';
import { DiffViewer } from '../../../dashboard-scene/settings/version-history/DiffViewer';

interface SaveDashboardDiffProps {
  oldValue?: unknown;
  newValue?: unknown;

  // calculated by parent so we can see summary in tabs
  diff?: Diffs;
  hasFolderChanges?: boolean;
  oldFolder?: string;
  newFolder?: string;
}

export const SaveDashboardDiff = ({
  diff,
  oldValue,
  newValue,
  hasFolderChanges,
  oldFolder,
  newFolder,
}: SaveDashboardDiffProps) => {
  const loader = useAsync(async () => {
    const oldJSON = JSON.stringify(oldValue ?? {}, null, 2);
    const newJSON = JSON.stringify(newValue ?? {}, null, 2);

    // Schema changes will have MANY changes that the user will not understand
    let schemaChange: ReactElement | undefined = undefined;
    const diffs: ReactElement[] = [];
    const count = Object.values(diff ?? {}).reduce((acc, changes) => acc + changes.length, 0);

    let runningCount = 0;
    for (const [key, changes] of Object.entries(diff ?? {})) {
      if (runningCount + changes.length > 100) {
        continue;
      }
      runningCount += changes.length;

      // this takes a long time for large diffs (so this is async)
      const g = <DiffGroup diffs={changes} key={key} title={key} />;
      if (key === 'schemaVersion') {
        schemaChange = g;
      } else {
        diffs.push(g);
      }
    }
    
    return {
      schemaChange,
      diffs,
      runningCount,
      count,
      showDiffs: true, // overwhelming if too many changes
      jsonView: <DiffViewer oldValue={oldJSON} newValue={newJSON} />,
    };
  }, [diff, oldValue, newValue]);

  const { value } = loader;

  return (
    <Stack direction="column" gap={1}>
      {hasFolderChanges && (
        <DiffGroup
          diffs={[
            {
              op: 'replace',
              value: newFolder,
              originalValue: oldFolder,
              path: [],
              startLineNumber: 0,
              endLineNumber: 0,
            },
          ]}
          key={'folder'}
          title={'folder'}
        />
      )}
      {(!value || !oldValue) && <Spinner />}
      {value && value.count >= 100 && (
        <Box paddingTop={1}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <Icon name="shield-exclamation" style={{ fill: 'goldenrod' }} />
            <span style={{ marginLeft: 4 }}>
              Many changes detected, showing {value.runningCount} out of {value.count} changes
            </span>
          </span>
        </Box>
      )}
      {value && value.count >= 1 && value.count < 100 && (
        <>
          {value && value.schemaChange && value.schemaChange}
          {value && value.showDiffs && value.diffs}
          <Box paddingTop={1}>
            <h4>Full JSON diff</h4>
            {value.jsonView}
          </Box>
        </>
      )}
      {value && value.count === 0 && <Box paddingTop={1}>No changes in the dashboard JSON</Box>}
    </Stack>
  );
};
