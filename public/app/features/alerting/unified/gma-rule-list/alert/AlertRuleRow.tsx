import { Stack, Text, TextLink } from '@grafana/ui';

import { useFolderPath } from '../shared/caches';

import { type AlertRuleSearchHit } from './searchHit';

interface AlertRuleRowProps {
  hit: AlertRuleSearchHit;
  /** Folder path is shown in List mode only - Folders mode already shows it on the folder
   * row, so repeating it on every rule row would be redundant (alert-rules-page.md). */
  showFolderPath: boolean;
}

/**
 * Minimal temporary row shared by Folders and List mode: linked title and, in List mode
 * only, the folder path. The full row (state/health, badges, actions, routing, etc.) is
 * later wave (R1) work - this exists so browsing has something to render meanwhile.
 */
export function AlertRuleRow({ hit, showFolderPath }: AlertRuleRowProps) {
  const path = useFolderPath(showFolderPath ? hit.folderUid : undefined);

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <TextLink href={`/alerting/grafana/${hit.uid}/view`} inline={false}>
        {hit.title}
      </TextLink>
      {showFolderPath && (
        <Text color="secondary" variant="bodySmall">
          {path ? path.join(' / ') : ''}
        </Text>
      )}
    </Stack>
  );
}
