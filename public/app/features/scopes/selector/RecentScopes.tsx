import { css } from '@emotion/css';
import { useEffect, useId, useState } from 'react';

import { type GrafanaTheme2, type Scope } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2, Stack, Text, Icon, Box, Tooltip } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

import { ScopeMetadata, hasScopeMetadata } from './ScopeMetadata';
import { type RecentScopeSet } from './types';
import { useScopeNode } from './useScopeNode';

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
  const services = useScopesServices();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const { node } = useScopeNode(recentScopeSet.scopeNodeId);
  const multiple = recentScopeSet.scopes.length > 1;

  useEffect(() => {
    let cancelled = false;
    const service = services?.scopesSelectorService;
    if (service) {
      Promise.all(recentScopeSet.scopeIds.map((id) => service.getScope(id))).then((result) => {
        if (!cancelled) {
          setScopes(result.filter((s): s is Scope => Boolean(s)));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [recentScopeSet.scopeIds, services?.scopesSelectorService]);

  // The node description belongs to a single scope, so it is only shown when the set has one.
  const metadata = recentScopeSet.scopes
    .map(({ id, title }) => ({
      id,
      title: multiple ? title : undefined,
      description: multiple ? undefined : node?.spec.description,
      filters: scopes.find((s) => s.metadata.name === id)?.spec.filters,
    }))
    .filter(hasScopeMetadata);

  const button = (
    <button
      className={styles.recentScopeButton}
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
  );

  if (metadata.length === 0) {
    return button;
  }

  return (
    <Tooltip
      content={
        <Stack direction="column" gap={1} alignItems="flex-start">
          {metadata.map(({ id, title, description, filters }) => (
            <ScopeMetadata key={id} title={title} description={description} filters={filters} />
          ))}
        </Stack>
      }
      placement="right"
    >
      {button}
    </Tooltip>
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
