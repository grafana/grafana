import { css } from '@emotion/css';
import { type ReactElement } from 'react';
import { useAsync } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Spinner, Stack, useStyles2 } from '@grafana/ui';
import { MonacoDiffEditor } from 'app/core/components/MonacoDiffEditor/MonacoDiffEditor';
import { type Diffs } from 'app/features/dashboard-scene/settings/version-history/utils';

import { DiffGroup } from '../../../dashboard-scene/settings/version-history/DiffGroup';

interface SaveDashboardDiffProps {
  oldValue?: unknown;
  newValue?: unknown;

  // calculated by parent so we can see summary in tabs
  diff?: Diffs;
  hasFolderChanges?: boolean;
  oldFolder?: string;
  newFolder?: string;
  /** Metadata-only denylist change (not part of Spec JSON). */
  hasPredefinedVariablesChanges?: boolean;
  oldPredefinedVariables?: string;
  newPredefinedVariables?: string;
  hasMigratedToV2?: boolean;
  /** Fill a height-constrained container, with the summary scrolling separately above the editor. */
  fillHeight?: boolean;
}

export const SaveDashboardDiff = ({
  diff,
  oldValue,
  newValue,
  hasFolderChanges,
  oldFolder,
  newFolder,
  hasPredefinedVariablesChanges,
  oldPredefinedVariables,
  newPredefinedVariables,
  hasMigratedToV2,
  fillHeight = false,
}: SaveDashboardDiffProps) => {
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
      oldJSON,
      newJSON,
    };
  }, [diff, oldValue, newValue]);

  const { value } = loader;

  return (
    <Stack direction="column" gap={1} height={fillHeight ? '100%' : undefined} minHeight={0}>
      <div className={fillHeight ? styles.summary : undefined}>
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
          {hasPredefinedVariablesChanges && (
            <DiffGroup
              diffs={[
                {
                  op: 'replace',
                  value: newPredefinedVariables,
                  originalValue: oldPredefinedVariables,
                  path: [],
                  startLineNumber: 0,
                  endLineNumber: 0,
                },
              ]}
              key={'predefined-variables'}
              title={t('dashboard.save-dashboard-diff.title-predefined-variables', 'predefined variables')}
            />
          )}
          {(!value || !oldValue) && <Spinner />}
          {value && value.count >= 1 ? (
            <>
              {!hasMigratedToV2 && value.schemaChange}
              {value.showDiffs && value.diffs}
            </>
          ) : (
            <Box paddingTop={1}>
              <Trans i18nKey="dashboard.save-dashboard-diff.no-changes-in-the-dashboard-json">
                No changes in the dashboard JSON
              </Trans>
            </Box>
          )}
        </Stack>
      </div>
      {value && value.count >= 1 && (
        <Box paddingTop={1} flex={fillHeight ? 1 : undefined} minHeight={0}>
          <MonacoDiffEditor
            original={value.oldJSON}
            modified={value.newJSON}
            language="json"
            height={fillHeight ? '100%' : '65vh'}
          />
        </Box>
      )}
    </Stack>
  );
};

const getStyles = () => ({
  summary: css({
    overflow: 'auto',
    maxHeight: '50%',
    flexShrink: 0,
  }),
});
