import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2, Stack, Text, Icon, Box } from '@grafana/ui';

import { RecentScope } from './types';

interface RecentScopesProps {
  recentScopes: RecentScope[][];
  onSelect: (scopeIds: string[], parentNodeId?: string) => void;
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
            <Trans i18nKey="command-palette.section.recent-scopes" />
          </Text>
        </button>
      </legend>
      <Box paddingLeft={3} paddingTop={expanded ? 1 : 0} paddingBottom={expanded ? 1 : 0}>
        <Stack direction="column" gap={1} id={contentId}>
          {expanded &&
            recentScopes.map((recentScopeSet) => (
              <button
                className={styles.recentScopeButton}
                key={recentScopeSet.map((s) => s.metadata.name).join(',')}
                onClick={() => {
                  onSelect(
                    recentScopeSet.map((s) => s.metadata.name),
                    recentScopeSet[0]?.parentNode?.metadata?.name
                  );
                }}
              >
                <Text truncate>{recentScopeSet.map((s) => s.spec.title).join(', ')}</Text>
                {recentScopeSet[0]?.parentNode?.spec.title && (
                  <Text truncate variant="body" color="secondary">
                    {recentScopeSet[0]?.parentNode?.spec.title}
                  </Text>
                )}
              </button>
            ))}
        </Stack>
      </Box>
    </fieldset>
  );
};

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
