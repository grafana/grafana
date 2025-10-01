import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Grid, Stack, Text, useStyles2, ButtonGroup, ToolbarButton, TextLink, Badge } from '@grafana/ui';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';
import { HackathonTable, TableColumn, ExpandedContent } from 'app/features/browse-dashboards/hackathon14/HackathonTable';
import { useGetPopularAlerts } from 'app/features/dashboard/api/popularResourcesApi';
import { AllAlertsPreview } from './AllAlertsPreview';

type ViewMode = 'card' | 'list';

export const PopularAlerts = () => {
  const styles = useStyles2(getStyles);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { data } = useGetPopularAlerts({ limit: 10 });

  const handleResourceClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

  const getStateBadgeConfig = (state?: string) => {
    switch (state) {
      case 'firing':
        return { color: 'red' as const, text: 'Firing' };
      case 'pending':
        return { color: 'orange' as const, text: 'Pending' };
      case 'inactive':
        return { color: 'blue' as const, text: 'Normal' };
      default:
        return { color: 'purple' as const, text: 'Normal' };
    }
  };

  const columns: TableColumn[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2fr',
      render: (resource) => (
        <div>
          <Text variant="body" weight="medium">
            {resource.title}
          </Text>
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Group',
      width: '1.5fr',
      render: (resource) => (
        <Text variant="bodySmall" color="secondary">
          {resource.folderTitle || 'Default'}
        </Text>
      ),
    },
    {
      key: 'views',
      header: 'Views',
      width: '120px',
      render: (resource) => (
        <Text variant="bodySmall" color="secondary">
          {resource.visitCount || 0}
        </Text>
      ),
    },
    {
      key: 'activity',
      header: 'State',
      width: '120px',
      render: (resource) => {
        const config = getStateBadgeConfig(resource.state);
        return <Badge text={config.text} color={config.color} />;
      },
    },
  ];

  const expandedContent: ExpandedContent = {
    render: (resource) => (
      <Stack direction="column" gap={1}>
        <div>
          <Text variant="bodySmall" weight="medium" color="secondary">
            UID:
          </Text>
          <Text variant="bodySmall"> {resource.uid}</Text>
        </div>
        <div>
          <Text variant="bodySmall" weight="medium" color="secondary">
            Folder:
          </Text>
          <Text variant="bodySmall"> {resource.folderTitle || 'Default'}</Text>
        </div>
        {resource.lastVisited && (
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              Last viewed:
            </Text>
            <Text variant="bodySmall"> {new Date(resource.lastVisited).toLocaleString()}</Text>
          </div>
        )}
      </Stack>
    ),
  };

  if (data?.resources?.length === 0 || data?.resources === null) {
    return null;
  }

  return (
    <Box marginTop={4}>
      <BrowsingSectionTitle
        title="Popular Alerts"
        subtitle="Most visited alerts"
        icon="history"
        actions={
          <Stack direction="row" gap={2} alignItems="center">
            <ButtonGroup>
              <div className={viewMode === 'card' ? styles.activeToggle : ''}>
                <ToolbarButton
                  icon="apps"
                  variant="default"
                  onClick={() => setViewMode('card')}
                  tooltip="Card view"
                />
              </div>
              <div className={viewMode === 'list' ? styles.activeToggle : ''}>
                <ToolbarButton
                  icon="list-ul"
                  variant="default"
                  onClick={() => setViewMode('list')}
                  tooltip="List view"
                />
              </div>
            </ButtonGroup>
            <TextLink color="secondary" href="/alerting/list/hackathon14/view-all-alerts" className={styles.viewAllLink}>
              View All
            </TextLink>
          </Stack>
        }
      />
      <Box marginTop={2}>
        {data && data.resources?.length > 0 && (
          <>
            {viewMode === 'card' ? (
              <Grid gap={2} columns={{ xs: 1, sm: 2 }}>
                {data.resources.map((resource) => (
                  <RecentVisitCard
                    key={resource.uid}
                    type="alert"
                    title={resource.title}
                    subtitle={`${resource.visitCount} views`}
                    onClick={() => handleResourceClick(resource.uid)}
                  />
                ))}
              </Grid>
            ) : (
              <HackathonTable
                data={data.resources}
                columns={columns}
                expandedContent={expandedContent}
                onRowClick={(resource) => handleResourceClick(resource.uid)}
              />
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  activeToggle: css({
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: -2,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.shape.radius.default,
    },
  }),

  viewAllLink: css({
    textDecoration: 'underline',
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});
