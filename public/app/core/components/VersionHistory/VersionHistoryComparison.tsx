import { identity } from 'lodash';
import { useState } from 'react';

import { dateTimeFormatTimeAgo, IconName } from '@grafana/data';
import { Badge, BadgeColor, Box, Button, Divider, Icon, Stack, Text } from '@grafana/ui';
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

const RenderCreatedBy = ({
  user,
  iconName,
  badge,
  badgeColor,
}: {
  user: string;
  iconName?: IconName;
  badge?: boolean;
  badgeColor?: BadgeColor;
}) => {
  if (badge) {
    return <Badge color={badgeColor || 'blue'} text={user} icon={iconName} />;
  }
  return (
    <Text>
      <span>
        {iconName && <Icon name={iconName} />}
        {user}
      </span>
    </Text>
  );
};

const VersionChangeSummary = ({ info }: { info: RevisionModel }) => {
  const { created, createdBy, version, message = '' } = info;
  const ageString = dateTimeFormatTimeAgo(created);
  return (
    <Trans i18nKey="core.versionHistory.comparison.header.text">
      Version {{ version }} updated by <RenderCreatedBy user={createdBy} /> ({{ ageString }}) {{ message }}
    </Trans>
  );
};

export const VersionHistoryComparison = <T extends DiffArgument>({
  oldInfo,
  newInfo,
  oldVersion,
  newVersion,
  preprocessVersion = identity,
}: DiffViewProps<T>) => {
  const diff = jsonDiff(preprocessVersion(oldVersion), preprocessVersion(newVersion));
  const [showJsonDiff, setShowJsonDiff] = useState(false);

  return (
    <Stack gap={2} direction="column">
      <Box>
        <Text>
          <VersionChangeSummary info={oldInfo} />
        </Text>
        <Icon name="arrow-right" />
        <Text>
          <VersionChangeSummary info={newInfo} />
        </Text>
      </Box>
      <Box>
        {Object.entries(diff).map(([key, diffs]) => (
          <DiffGroup diffs={diffs} key={key} title={key} />
        ))}
        <Divider />
      </Box>
      <Box>
        {showJsonDiff && (
          <Button variant="secondary" size="sm" onClick={() => setShowJsonDiff(false)}>
            <Trans i18nKey="core.versionHistory.comparison.header.hide-json-diff">Hide JSON diff </Trans>
          </Button>
        )}
        {!showJsonDiff && (
          <Button variant="secondary" size="sm" onClick={() => setShowJsonDiff(true)}>
            <Trans i18nKey="core.versionHistory.comparison.header.show-json-diff">Show JSON diff </Trans>
          </Button>
        )}
      </Box>
      {showJsonDiff && (
        <DiffViewer oldValue={JSON.stringify(oldVersion, null, 2)} newValue={JSON.stringify(newVersion, null, 2)} />
      )}
    </Stack>
  );
};
