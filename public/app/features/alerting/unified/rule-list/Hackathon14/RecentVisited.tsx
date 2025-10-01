import { Grid } from '@grafana/ui';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';
import { getRelativeTime } from 'app/features/browse-dashboards/hackathon14/RecentVisited';
import { useGetRecentAlerts } from 'app/features/dashboard/api/popularResourcesApi';
import { QuickStart } from './QuickStart';

export const RecentVisited = () => {
  const { data } = useGetRecentAlerts({ limit: 4 });

  const handleResourceClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

  if (data?.resources?.length === 0 || data?.resources === null) {
    return <QuickStart />;
  }

  return (
    <>
      <BrowsingSectionTitle title="Recently Visited" subtitle="Alerts you've explored" icon="history" />
      <div>
        {data && data.resources?.length > 0 && (
          <Grid gap={2} columns={{ xs: 1, sm: 2 }}>
            {data.resources.map((resource) => (
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
