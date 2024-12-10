import { useCallback, useState } from 'react';

import { Box, EmptySearchResult, Grid, Input, Pagination, Select, Stack } from '@grafana/ui';
import DashboardTemplateImport from 'app/features/dashboard/dashgrid/DashboardTemplateImport';

import { TemplateItem } from './CommunityTemplateItem';
import { useCommunityTemplates } from './hooks';
import { SORT_BY_OPTIONS, SortBy } from './types';

interface CommunityTemplateListProps {}

export function CommunityTemplateList({}: CommunityTemplateListProps) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(SORT_BY_OPTIONS[0].value);
  const [filter, setFilter] = useState('');
  const { dashboards, pages, loading, error, page: currentPage } = useCommunityTemplates({ sortBy, page, filter });
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
        <>
          <Grid columns={3} gap={2} alignItems="stretch">
            {dashboards.map((d) => (
              <TemplateItem key={d.slug} dashboard={d} onClick={(d) => onOpenImportTemplate(d)} />
            ))}
          </Grid>
          <Pagination
            onNavigate={(toPage) => setPage(toPage)}
            numberOfPages={pages}
            currentPage={currentPage}
            hideWhenSinglePage
          />
        </>
      ) : (
        <EmptySearchResult>No Dashboards</EmptySearchResult>
      )}
      {openTemplateImportDrawer && (
        <DashboardTemplateImport dashboardUid={dashboardUid} onCancel={() => setOpenTemplateImportDrawer(false)} />
      )}
    </Stack>
  );
}
