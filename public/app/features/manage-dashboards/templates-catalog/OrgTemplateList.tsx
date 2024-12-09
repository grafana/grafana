import { useCallback, useState } from 'react';

import { Box, EmptySearchResult, Grid, Input, Select, Stack } from '@grafana/ui';
import DashboardTemplateImport from 'app/features/dashboard/dashgrid/DashboardTemplateImport';

import { OrgTemplateItem } from './OrgTemplateItem';
import { useOrgTemplates } from './hooks';
import { SORT_BY_OPTIONS, SortBy } from './types';

interface OrgTemplateListProps {}

export function OrgTemplateList({}: OrgTemplateListProps) {
  const [sortBy, setSortBy] = useState(SORT_BY_OPTIONS[0].value);
  const [filter, setFilter] = useState('');
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
      <Stack justifyContent="space-between">
        <Input
          placeholder="Search"
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          loading={loading}
        />
        <Box maxWidth={100}>
          <Select
            placeholder="Sort By"
            onChange={(option) => setSortBy(option.value as SortBy)}
            value={sortBy}
            options={SORT_BY_OPTIONS}
            isSearchable={false}
          />
        </Box>
      </Stack>
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
