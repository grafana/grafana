import { css } from '@emotion/css';

import { GrafanaTheme2, locale } from '@grafana/data';
import { useStyles2, Box, Stack, Text, Icon, TagList, Card, Button, LinkButton } from '@grafana/ui';
import { DashboardSearchItem } from 'app/features/search/types';

interface OrgTemplateItemProps {
  dashboard: DashboardSearchItem;
  compact?: boolean;
  onClick?: (dashboardId: string) => void;
}

export function OrgTemplateItem({ dashboard, compact = false, onClick }: OrgTemplateItemProps) {
  const onOpenTemplateDrawer = () => {
    onClick?.(String(dashboard.uid));
  };

  return (
    <Card>
      <Card.Heading>{dashboard.title}</Card.Heading>
      <Card.Tags>
        <TagList tags={dashboard.tags}></TagList>
      </Card.Tags>
      <Card.Meta>{dashboard.folderTitle || 'General'}</Card.Meta>
      <Card.Actions>
        <LinkButton href={dashboard.url} variant="secondary" fill="text">
          View
        </LinkButton>
        <Button onClick={onOpenTemplateDrawer}>Use as template</Button>
      </Card.Actions>
    </Card>
  );
}
