import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Badge,
  Box,
  ButtonGroup,
  Grid,
  Stack,
  Text,
  TextLink,
  ToolbarButton,
  useStyles2,
} from '@grafana/ui';
import { useGetPopularAlerts } from 'app/features/dashboard/api/popularResourcesApi';

import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';
import { HackathonTable, TableColumn } from 'app/features/browse-dashboards/hackathon14/HackathonTable';

type ViewMode = 'card' | 'list';

const PREVIEW_LIMIT = 12;

export const AllAlertsPreview = () => {
  const styles = useStyles2(getStyles);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const { data, isLoading } = useGetPopularAlerts({ limit: 100 });
  const alerts = useMemo(() => data?.resources ?? [], [data]);

  const previewAlerts = useMemo(() => alerts.slice(0, PREVIEW_LIMIT), [alerts]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        width: '2fr',
        render: (resource) => (
          <Text weight="medium" className={styles.truncate} title={resource.title}>
            {resource.title}
          </Text>
        ),
      },
      {
        key: 'group',
        header: 'Group',
        width: '1.5fr',
        render: (resource) => (
          <Text variant="bodySmall" color="secondary" className={styles.truncate} title={resource.folderTitle}>
            {resource.folderTitle || 'Default'}
          </Text>
        ),
      },
      {
        key: 'state',
        header: 'State',
        width: '120px',
        render: (resource) => <Badge text={resource.state ? resource.state : 'Normal'} color="blue" />,
      },
      {
        key: 'views',
        header: 'Views',
        width: '100px',
        render: (resource) => (
          <Text variant="bodySmall" color="secondary">
            {resource.visitCount ?? 0}
          </Text>
        ),
      },
    ],
    [styles]
  );

  const handleToggleView = (mode: ViewMode) => setViewMode(mode);
  const handleViewAll = () => {
    window.location.href = '/alerting/list/hackathon14/view-all-alerts';
  };

  const handleAlertClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

  return (
    <Box className={styles.container}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" className={styles.header}>
        <Stack direction="column" gap={0.5}>
          <Text variant="h5" weight="medium">
            Explore all alerts
          </Text>
          <Text variant="bodySmall" color="secondary">
            Preview the latest rules across your organization.
          </Text>
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <ButtonGroup>
            <div className={viewMode === 'card' ? styles.activeToggle : ''}>
              <ToolbarButton icon="apps" variant="default" tooltip="Card view" onClick={() => handleToggleView('card')} />
            </div>
            <div className={viewMode === 'list' ? styles.activeToggle : ''}>
              <ToolbarButton icon="list-ul" variant="default" tooltip="List view" onClick={() => handleToggleView('list')} />
            </div>
          </ButtonGroup>
          <TextLink onClick={handleViewAll}>View all</TextLink>
        </Stack>
      </Stack>

      {isLoading ? (
        <Text variant="bodySmall" color="secondary" className={styles.loadingText}>
          Loading alerts…
        </Text>
      ) : previewAlerts.length === 0 ? (
        <Text variant="bodySmall" color="secondary" className={styles.loadingText}>
          No alert rules found yet.
        </Text>
      ) : viewMode === 'card' ? (
        <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3 }}>
          {previewAlerts.map((resource) => (
            <RecentVisitCard
              key={resource.uid}
              type="alert"
              title={resource.title}
              subtitle={resource.folderTitle || 'Default'}
              onClick={() => handleAlertClick(resource.uid)}
            />
          ))}
        </Grid>
      ) : (
        <HackathonTable data={previewAlerts} columns={columns} onRowClick={(resource) => handleAlertClick(resource.uid)} />
      )}
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    border: `1px solid ${theme.colors.border.strong}`,
    borderRadius: theme.shape.radius.lg,
    padding: theme.spacing(3),
    background: theme.colors.background.primary,
    boxShadow: `0 20px 40px -34px ${theme.colors.primary.shade}`,
  }),

  header: css({
    marginBottom: theme.spacing(2),
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  }),

  activeToggle: css({
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: -2,
      height: 2,
      borderRadius: 2,
      background: theme.colors.primary.main,
    },
  }),

  loadingText: css({
    marginTop: theme.spacing(2),
  }),

  truncate: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});


