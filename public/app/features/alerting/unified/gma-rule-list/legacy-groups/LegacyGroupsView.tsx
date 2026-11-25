import { useState } from 'react';
import { useDebounce } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Box, FilterInput, Stack, Text } from '@grafana/ui';

import { LegacyGroupList } from './LegacyGroupList';
import { type LegacyGroupsListingArg } from './legacyGroupsApi';

const SEARCH_DEBOUNCE_MS = 300;

export function LegacyGroupsView() {
  const [groupInput, setGroupInput] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [search, setSearch] = useState<LegacyGroupsListingArg>({ groupName: '', folder: '' });
  useDebounce(() => setSearch({ groupName: groupInput.trim(), folder: folderInput.trim() }), SEARCH_DEBOUNCE_MS, [
    groupInput,
    folderInput,
  ]);

  const groupLabel = t('alerting.gma-rule-list.legacy-groups.search-group', 'Search by group name');
  const folderLabel = t('alerting.gma-rule-list.legacy-groups.search-folder', 'Filter by folder');

  return (
    <Stack direction="column" gap={2}>
      <Text color="secondary">
        <Trans i18nKey="alerting.gma-rule-list.legacy-groups.intro">
          Evaluation groups used to bundle rules in a folder under one evaluation interval. The rule pages no longer
          show them: every rule keeps running on its interval and appears directly in its folder. Groups you leave here
          keep working, but you won&apos;t see them anywhere else. To keep a group&apos;s rules together, convert it
          into a subfolder named after the group.
        </Trans>
      </Text>
      <Stack direction="row" gap={1} wrap="wrap">
        <Box flex={1} minWidth={30}>
          <FilterInput
            value={groupInput}
            onChange={setGroupInput}
            placeholder={groupLabel}
            aria-label={groupLabel}
            // Sent as plain words; escaping would send "us\-east".
            escapeRegex={false}
          />
        </Box>
        <Box flex={1} minWidth={30}>
          <FilterInput
            value={folderInput}
            onChange={setFolderInput}
            placeholder={folderLabel}
            aria-label={folderLabel}
            escapeRegex={false}
          />
        </Box>
      </Stack>
      <LegacyGroupList key={`${search.groupName}\u0000${search.folder}`} search={search} />
    </Stack>
  );
}
