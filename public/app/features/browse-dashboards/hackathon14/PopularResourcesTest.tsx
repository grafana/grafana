import React from 'react';
import { useGetPopularResourcesQuery, useGetPopularDashboards } from '../../dashboard/api/popularResourcesApi';

export const PopularResourcesTest = () => {
  // Test different queries
  const { data: allResources, isLoading: allLoading } = useGetPopularResourcesQuery({ 
    limit: 10, 
    period: '30d' 
  });
  
  const { data: dashboards, isLoading: dashboardsLoading } = useGetPopularDashboards({ 
    limit: 5, 
    period: '7d' 
  });

  if (allLoading || dashboardsLoading) {
    return <div>Loading popular resources...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>All Popular Resources (Last 30 days)</h3>
      <pre>{JSON.stringify(allResources, null, 2)}</pre>
      
      <h3>Popular Dashboards (Last 7 days)</h3>
      <pre>{JSON.stringify(dashboards, null, 2)}</pre>
    </div>
  );
};
