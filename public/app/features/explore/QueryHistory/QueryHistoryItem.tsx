import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Stack, Text, useStyles2 } from '@grafana/ui';
import { RichHistoryQuery } from 'app/types/explore';

export interface QueryHistoryItemProps {
  query: RichHistoryQuery;
  onSelect: () => void;
}

export function QueryHistoryItem({ query, onSelect }: QueryHistoryItemProps) {
  const styles = useStyles2(getStyles);
  
  const firstQuery = query.queries?.[0] as any;
  const queryText = firstQuery?.expr || 
                   firstQuery?.query || 
                   JSON.stringify(firstQuery || {});
  
  const datasourceName = query.datasourceName || 'Unknown';
  const timeAgo = query.createdAt ? formatDistanceToNow(query.createdAt, { addSuffix: true }) : '';

  return (
    <Card className={styles.card}>
      <Card.Heading className={styles.heading}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="column" gap={0}>
            <Text variant="body" weight="medium">
              {datasourceName}
            </Text>
            {timeAgo && (
              <Text variant="bodySmall" color="secondary">
                {timeAgo}
              </Text>
            )}
          </Stack>
          <Button variant="secondary" size="sm" onClick={onSelect}>
            Use query
          </Button>
        </Stack>
      </Card.Heading>
      <Card.Description>
        <pre className={styles.queryText}>
          {queryText}
        </pre>
      </Card.Description>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    marginBottom: theme.spacing(1),
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
    },
  }),
  heading: css({
    paddingBottom: theme.spacing(1),
  }),
  queryText: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    backgroundColor: theme.colors.background.canvas,
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    overflow: 'auto',
    maxHeight: '100px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }),
});
