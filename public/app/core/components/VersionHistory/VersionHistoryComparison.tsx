import { identity } from 'lodash';

import { dateTimeFormatTimeAgo } from '@grafana/data';
import { Box, Divider, Icon, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
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
  /**
   * Helper method to tweak the calculated diff for the human readable output.
   *
   * e.g. mapping machine IDs to translated names, removing fields that the user can't control anyway etc.
   */
  preprocessVersion?: (version: T) => DiffArgument;
};

// remove id, version etc
// map names to human readable names

export const VersionHistoryComparison = <T extends DiffArgument>({
  oldInfo,
  newInfo,
  oldVersion,
  newVersion,
  preprocessVersion = identity,
}: DiffViewProps<T>) => {
  const diff = jsonDiff(preprocessVersion(oldVersion), preprocessVersion(newVersion));

  const oldVersionAgeString = dateTimeFormatTimeAgo(oldInfo.created);
  const newVersionAgeString = dateTimeFormatTimeAgo(newInfo.created);

  return (
    <Stack gap={2} direction="column">
      <Box>
        <Text>
          <Trans i18nKey="core.versionHistory.comparison.header.text">
            Version {{ version: oldInfo.version }} updated by {{ updatedBy: oldInfo.createdBy }} (
            {{ ageString: oldVersionAgeString }}) {{ message: oldInfo.message || '' }}
          </Trans>
        </Text>
        <Icon name="arrow-right" />
        <Text>
          <Trans i18nKey="core.versionHistory.comparison.header.text">
            Version {{ version: newInfo.version }} updated by {{ updatedBy: newInfo.createdBy }} (
            {{ ageString: newVersionAgeString }}) {{ message: newInfo.message || '' }}
          </Trans>
        </Text>
      </Box>
      <Box>
        {Object.entries(diff).map(([key, diffs]) => (
          <DiffGroup diffs={diffs} key={key} title={key} />
        ))}
        <Divider />
      </Box>
      <Text variant="h2">
        <Trans i18nKey="core.versionHistory.comparison.header.diff">JSON diff</Trans>
      </Text>
      <DiffViewer oldValue={JSON.stringify(oldVersion, null, 2)} newValue={JSON.stringify(newVersion, null, 2)} />
    </Stack>
  );
};
