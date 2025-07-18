import { ReactElement } from 'react';
import { useAsync } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Spinner, Stack } from '@grafana/ui';
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
  hasMigratedToV2?: boolean;
}

export const SaveDashboardDiff = ({
  diff,
  oldValue,
  newValue,
  hasFolderChanges,
  oldFolder,
  newFolder,
  hasMigratedToV2,
}: SaveDashboardDiffProps) => {
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

  return (
    <Stack direction="column" gap={1}>
      {hasMigratedToV2 && (
        <Box paddingTop={1}>
          <Alert
            title={t(
              'dashboard.save-dashboard-diff.title-because-dashboard-migrated-grafana-format',
              'The diff is hard to read because the dashboard has been migrated to the new Grafana dashboard format'
            )}
            severity="info"
          />
        </Box>
      )}
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
          title={t('dashboard.save-dashboard-diff.title-folder', 'folder')}
        />
      )}
      {(!value || !oldValue) && <Spinner />}
      {value && value.count >= 1 ? (
        <>
          {!hasMigratedToV2 && value && value.schemaChange && value.schemaChange}
          {value && value.showDiffs && value.diffs}
          <Box paddingTop={1}>
            <h4>
              <Trans i18nKey="dashboard.save-dashboard-diff.full-json-diff">Full JSON diff</Trans>
            </h4>
            {value.jsonView}
          </Box>
        </>
      ) : (
        <Box paddingTop={1}>
          <Trans i18nKey="dashboard.save-dashboard-diff.no-changes-in-the-dashboard-json">
            No changes in the dashboard JSON
          </Trans>
        </Box>
      )}
    </Stack>
  );
};
