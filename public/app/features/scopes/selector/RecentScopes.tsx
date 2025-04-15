import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Stack, Text, Icon } from '@grafana/ui';

import { SelectedScope } from './types';

interface RecentScopesProps {
  recentScopes: SelectedScope[][];
  onSelect: (scopes: SelectedScope[]) => void;
}

export const RecentScopes = ({ recentScopes, onSelect }: RecentScopesProps) => {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useState(false);

  const contentId = useId();
  return (
    <fieldset>
      <legend>
        <button
          className={styles.expandButton}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name={expanded ? 'angle-down' : 'angle-right'} />
          <Text variant="body">Recent scopes</Text>
        </button>
      </legend>
      <div className={styles.content}>
        <Stack direction="column" gap={1} id={contentId}>
          {expanded &&
            recentScopes.map((recentScopeSet) => (
              <button
                className={styles.recentScopeButton}
                key={recentScopeSet.map((s) => s.scope.metadata.name).join(',')}
                onClick={() => {
                  onSelect(recentScopeSet);
                }}
              >
                <Text>{recentScopeSet.map((s) => s.scope.spec.title).join(',')}</Text>
              </button>
            ))}
        </Stack>
      </div>
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
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
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
  content: css({
    paddingLeft: theme.spacing(3),
  }),
});
