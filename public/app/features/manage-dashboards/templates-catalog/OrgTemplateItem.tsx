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
    <Card onClick={onOpenTemplateDrawer}>
      <Card.Heading>{dashboard.title}</Card.Heading>
      <Card.Tags>
        <Stack>
          <LinkButton href={dashboard.url} target="blank" variant="secondary" fill="text">
            View
          </LinkButton>
        </Stack>
      </Card.Tags>
      <Card.Meta>{dashboard.folderTitle || 'General'}</Card.Meta>
    </Card>
  );
}
