import { useCallback, useState } from 'react';

import { Box, EmptySearchResult, LoadingPlaceholder, Stack } from '@grafana/ui';
import DashboardTemplateImport from 'app/features/dashboard/dashgrid/DashboardTemplateImport';

import { OrgTemplateItem } from './OrgTemplateItem';
import { useOrgTemplates } from './hooks';

interface OrgTemplateListProps {}

export function OrgTemplateList({}: OrgTemplateListProps) {
  const { dashboards, loading, error } = useOrgTemplates({});
  const [openTemplateImportDrawer, setOpenTemplateImportDrawer] = useState(false);
  const [dashboardUid, setDashboardUid] = useState<string>('');

  const onOpenImportTemplate = useCallback(
    (d: any) => {
      setOpenTemplateImportDrawer(true);
      setDashboardUid(d); // set the selected dashboard to import id and use it in the drawer
    },
    [setOpenTemplateImportDrawer]
  );

  return (
    <Stack gap={3} direction="column">
      {loading && <LoadingPlaceholder text="Loading org templates..." />}
      {error && <div>Error loading dashboards</div>}
      {dashboards && dashboards.length > 0 ? (
        <Stack direction="column">
          {dashboards.map((d) => (
            <OrgTemplateItem key={d.uid} dashboard={d} onClick={(d) => onOpenImportTemplate(d)} />
          ))}
        </Stack>
      ) : (
        <EmptySearchResult>No Dashboards</EmptySearchResult>
      )}
      {openTemplateImportDrawer && (
        <DashboardTemplateImport dashboardUid={dashboardUid} onCancel={() => setOpenTemplateImportDrawer(false)} />
      )}
    </Stack>
  );
}
