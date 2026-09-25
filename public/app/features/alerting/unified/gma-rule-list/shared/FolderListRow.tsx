import { type ReactNode } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';

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

  return (
    <div>
      <Stack direction="row" alignItems="center" gap={1}>
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={path ? path.join(' / ') : folderUid}>
          <Icon name={expanded ? 'angle-down' : 'angle-right'} />
        </button>
        <Text>{path ? path.join(' / ') : folderUid}</Text>
        <Text color="secondary">{ruleCount ?? '–'}</Text>
      </Stack>
      {expanded && <div>{children}</div>}
    </div>
  );
}
