import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2, Stack, Text, Icon, Box } from '@grafana/ui';

import { ScopeMetadataTooltip } from './ScopeMetadata';
import { type RecentScopeSet } from './types';

interface RecentScopesProps {
  recentScopes: RecentScopeSet[];
  onSelect: (scopeIds: string[], scopeNodeId?: string) => void;
}

export const RecentScopes = ({ recentScopes, onSelect }: RecentScopesProps) => {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useState(false);

  const contentId = useId();
  return (
    <fieldset>
      <legend className={styles.legend}>
        <button
          className={styles.expandButton}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(!expanded)}
          data-testid="scopes-selector-recent-scopes-section"
        >
          <Icon name={expanded ? 'angle-down' : 'angle-right'} />
          <Text variant="body">
            <Trans i18nKey="command-palette.section.recent-scopes">Recent scopes</Trans>
          </Text>
        </button>
      </legend>
      <Box paddingLeft={3} paddingTop={expanded ? 1 : 0} paddingBottom={expanded ? 1 : 0}>
        <Stack direction="column" gap={1} id={contentId}>
          {expanded &&
            recentScopes.map((recentScopeSet) => (
              <RecentScopeButton
                key={recentScopeSet.scopeIds.join(',')}
                recentScopeSet={recentScopeSet}
                onSelect={onSelect}
              />
            ))}
        </Stack>
      </Box>
    </fieldset>
  );
};

interface RecentScopeButtonProps {
  recentScopeSet: RecentScopeSet;
  onSelect: RecentScopesProps['onSelect'];
}

function RecentScopeButton({ recentScopeSet, onSelect }: RecentScopeButtonProps) {
  const styles = useStyles2(getStyles);
  const multiple = recentScopeSet.scopes.length > 1;

  // A stored scopeNodeId belongs to a single scope, so with several scopes each one resolves its own node.
  const sources = recentScopeSet.scopes.map(({ id, title }) => ({
    scopeId: id,
    title: multiple ? title : undefined,
    nodeId: multiple ? undefined : recentScopeSet.scopeNodeId,
  }));

  return (
    <ScopeMetadataTooltip sources={sources}>
      {(descriptionId) => (
        <button
          className={styles.recentScopeButton}
          aria-describedby={descriptionId}
          onClick={() => {
            onSelect(recentScopeSet.scopeIds, recentScopeSet.scopeNodeId);
          }}
        >
          <Text truncate>{recentScopeSet.scopes.map((s) => s.title).join(', ')}</Text>
          {recentScopeSet.parentNodeTitle && (
            <Text truncate variant="body" color="secondary">
              {recentScopeSet.parentNodeTitle}
            </Text>
          )}
        </button>
      )}
    </ScopeMetadataTooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  recentScopeButton: css({
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
  expandButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  }),
  legend: css({
    marginBottom: 0,
    padding: `${theme.spacing(0.5)} 0`,
  }),
});
