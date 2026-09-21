import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { type NodesMap, type QuickJumpGroup } from './types';

// Soft cap on rendered badges. Discovery is bounded too, but keep the row from growing unbounded on large orgs.
const MAX_VISIBLE_GROUPS = 20;

export interface ScopesQuickJumpGroupsProps {
  groups: QuickJumpGroup[];
  scopeNodes: NodesMap;
  onSelect: (scopeNodeId: string) => void;
}

export function ScopesQuickJumpGroups({ groups, scopeNodes, onSelect }: ScopesQuickJumpGroupsProps) {
  const styles = useStyles2(getStyles);
  const visibleGroups = groups.slice(0, MAX_VISIBLE_GROUPS);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} data-testid="scopes-tree-quick-jump-groups">
      <Stack direction="row" wrap="wrap" gap={1}>
        {visibleGroups.map((group) => {
          const title = scopeNodes[group.scopeNodeId]?.spec.title ?? group.scopeNodeId;
          const parentId = group.path[group.path.length - 2];
          const parentTitle = parentId ? scopeNodes[parentId]?.spec.title : undefined;
          const label = parentTitle ? `${parentTitle} / ${title}` : title;

          return (
            <Button
              key={group.scopeNodeId}
              size="sm"
              fill="outline"
              variant="secondary"
              onClick={() => onSelect(group.scopeNodeId)}
              data-testid={`scopes-tree-quick-jump-${group.scopeNodeId}`}
              aria-label={t('scopes.tree.quick-jump.aria-label', 'Jump to {{title}}', { title: label })}
            >
              {label}
            </Button>
          );
        })}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    margin: theme.spacing(1, 0),
  }),
});
