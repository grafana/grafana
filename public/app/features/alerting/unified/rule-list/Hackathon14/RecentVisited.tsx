import { Trans, t } from '@grafana/i18n';
import { Grid, Stack } from '@grafana/ui';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';
import { getRelativeTime } from 'app/features/browse-dashboards/hackathon14/RecentVisited';
import { useGetRecentAlerts } from 'app/features/dashboard/api/popularResourcesApi';
import { QuickStart } from './QuickStart';

export const RecentVisited = ({ showAll = false }: { showAll?: boolean }) => {
  const { data } = useGetRecentAlerts({ limit: showAll ? 100 : 4 });

  const handleResourceClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

const items = data?.resources ?? [];
  if (data?.resources?.length === 0 || data?.resources === null) {
    return <QuickStart />;
  }

  return (
    <>
      <BrowsingSectionTitle
        title={t('alerting.hackathon.recently-viewed.title', 'Recently Viewed')}
        subtitle={t('alerting.hackathon.recently-viewed-subtitle', "Alerts you've explored")}
        icon="history"
      />
      <div>
        {showAll ? (
          <Stack direction="column" gap={2}>
            {items.map((resource) => (
              <RecentVisitCard
                key={resource.uid}
                type="alert"
                title={resource.title}
                subtitle={getRelativeTime(resource.lastVisited)}
                onClick={() => handleResourceClick(resource.uid)}
              />
            ))}
          </Stack>
        ) : (
          <Grid gap={2} columns={{ xs: 1, sm: 2 }}>
            {items.map((resource) => (
              <RecentVisitCard
                key={resource.uid}
                type="alert"
                title={resource.title}
                subtitle={getRelativeTime(resource.lastVisited)}
                onClick={() => handleResourceClick(resource.uid)}
              />
            ))}
          </Grid>
        )}
      </div>
    </>
  );
};
