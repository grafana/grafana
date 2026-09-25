import { type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { Box, IconButton, Stack, Text } from '@grafana/ui';

import { useFolderPath } from './caches';

interface FolderListRowProps {
  folderUid: string;
  /** The rule kind's direct count for this folder (e.g. Alert rules only, never
   * descendant/Recording counts) - undefined while its `/counts` lookup is pending. */
  ruleCount: number | undefined;
  expanded: boolean;
  onToggle: () => void;
  /** Rendered only while expanded - the folder's own rule-search results. */
  children?: ReactNode;
}

/**
 * Shared Folders-mode row: full folder path (from `/parents`, so folders with the same title
 * stay distinguishable) plus the rule-kind-specific direct count, expandable to show that
 * folder's rules. Shared because both the Alert and Recording pages need the same behavior
 * here - only the count and the expanded content are rule-kind-specific.
 */
export function FolderListRow({ folderUid, ruleCount, expanded, onToggle, children }: FolderListRowProps) {
  const path = useFolderPath(folderUid);
  const pathLabel = path ? path.join(' / ') : folderUid;

  return (
    <div>
      <Stack direction="row" alignItems="center" gap={1}>
        <IconButton
          name={expanded ? 'angle-down' : 'angle-right'}
          aria-expanded={expanded}
          aria-label={pathLabel}
          onClick={onToggle}
        />
        <Text>{pathLabel}</Text>
        <Text color="secondary">{ruleCount ?? t('alerting.gma-rule-list.folder-row.count-unavailable', '–')}</Text>
      </Stack>
      {/* Indented past the folder's own icon+label so its rules read as nested under it,
          rather than as siblings starting at the same edge. */}
      {expanded && <Box paddingLeft={6}>{children}</Box>}
    </div>
  );
}
