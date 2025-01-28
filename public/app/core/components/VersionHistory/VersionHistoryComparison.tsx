import { dateTimeFormatTimeAgo } from '@grafana/data';
import { Stack, Icon, Box, Divider, Text } from '@grafana/ui';
import { DiffGroup } from 'app/features/dashboard-scene/settings/version-history/DiffGroup';
import { DiffViewer } from 'app/features/dashboard-scene/settings/version-history/DiffViewer';
import { jsonDiff } from 'app/features/dashboard-scene/settings/version-history/utils';

/** Meta information about a version of an entity */
export interface RevisionModel {
  version: number | string;
  /** When was this version created? */
  created: string;
  /** Who created/edited this version? */
  createdBy: string;
  /** Optional message describing change encapsulated in this version */
  message?: string;
}

type DiffArgument = Parameters<typeof jsonDiff>[0];

type DiffViewProps<T extends DiffArgument> = {
  newInfo: RevisionModel;
  oldInfo: RevisionModel;
  oldVersion: T;
  newVersion: T;
};

export const VersionHistoryComparison = <T extends DiffArgument>({
  oldInfo,
  newInfo,
  oldVersion,
  newVersion,
}: DiffViewProps<T>) => {
  const diff = jsonDiff(oldVersion, newVersion);
  const oldVersionAgeString = dateTimeFormatTimeAgo(oldInfo.created);
  const newVersionAgeString = dateTimeFormatTimeAgo(newInfo.created);

  return (
    <Stack gap={2} direction="column">
      <Box>
        <Text>
          Version {oldInfo.version} updated by {oldInfo.createdBy} ({oldVersionAgeString}){oldInfo.message}
        </Text>

        <Icon name="arrow-right" />

        <Text>
          Version {newInfo.version} updated by {newInfo.createdBy} ({newVersionAgeString}){newInfo.message}
        </Text>
      </Box>
      <Box>
        {Object.entries(diff).map(([key, diffs]) => (
          <DiffGroup diffs={diffs} key={key} title={key} />
        ))}
        <Divider />
      </Box>
      <Text variant="h2">JSON diff</Text>
      <DiffViewer oldValue={JSON.stringify(oldVersion, null, 2)} newValue={JSON.stringify(newVersion, null, 2)} />
    </Stack>
  );
};
