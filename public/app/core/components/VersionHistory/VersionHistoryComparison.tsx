import { identity } from 'lodash';
import { useState } from 'react';

import { dateTimeFormatTimeAgo } from '@grafana/data';
import { Box, Button, Divider, EmptyState, Icon, Stack, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
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
  /** Information to help summarise the change in the newer version */
  newSummary: RevisionModel;
  /** Information to help summarise the change in the older version */
  oldSummary: RevisionModel;
  /** The actual data model of the older version */
  oldVersion: T;
  /** The actual data model of the newer version */
  newVersion: T;
  /**
   * Helper method to tweak the calculated diff for the human readable output.
   *
   * e.g. mapping machine IDs to translated names, removing fields that the user can't control anyway etc.
   */
  preprocessVersion?: (version: T) => DiffArgument;
};

const VersionChangeSummary = ({ info }: { info: RevisionModel }) => {
  const { created, createdBy, version, message = '' } = info;
  const ageString = dateTimeFormatTimeAgo(created);
  return (
    <Trans i18nKey="core.versionHistory.comparison.header.text">
      Version {{ version }} updated by {{ createdBy }} ({{ ageString }}) {{ message }}
    </Trans>
  );
};

export const VersionHistoryComparison = <T extends DiffArgument>({
  oldSummary,
  newSummary,
  oldVersion,
  newVersion,
  preprocessVersion = identity,
}: DiffViewProps<T>) => {
  const diff = jsonDiff(preprocessVersion(oldVersion), preprocessVersion(newVersion));
  const noHumanReadableDiffs = Object.entries(diff).length === 0;
  const [showJsonDiff, setShowJsonDiff] = useState(noHumanReadableDiffs);

  return (
    <Stack gap={2} direction="column">
      <Box>
        <Text variant="h5" element="h4">
          <VersionChangeSummary info={oldSummary} />
          <Icon name="arrow-right" />
          <VersionChangeSummary info={newSummary} />
        </Text>
      </Box>
      <Box>
        {noHumanReadableDiffs && (
          <EmptyState
            message={t('core.versionHistory.no-properties-changed', 'No relevant properties changed')}
            variant="not-found"
            hideImage
          >
            <Trans i18nKey="core.versionHistory.view-json-diff">View JSON diff to see all changes</Trans>
          </EmptyState>
        )}
        {Object.entries(diff).map(([key, diffs]) => (
          <DiffGroup diffs={diffs} key={key} title={key} />
        ))}
        <Divider />
      </Box>
      <Box>
        {showJsonDiff && (
          <Button variant="secondary" onClick={() => setShowJsonDiff(false)}>
            <Trans i18nKey="core.versionHistory.comparison.header.hide-json-diff">Hide JSON diff </Trans>
          </Button>
        )}
        {!showJsonDiff && (
          <Button variant="secondary" onClick={() => setShowJsonDiff(true)}>
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
