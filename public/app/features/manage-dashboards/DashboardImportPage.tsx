import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsync } from 'react-use';

import { locale } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Box, EmptySearchResult, Grid, Input, Pagination, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

type Link = {
  rel: string;
  href: string;
};

type Screenshot = {
  id: number;
  dashboardId: number;
  name: string;
  filename: string;
  mainScreenshot: boolean;
  createdAt: string; // ISO 8601 date string
  updatedAt: string | null; // Can be null
  links: Link[];
};

type Logo = {
  small: {
    type: string; // MIME type, e.g., "image/png"
    filename: string;
    content: string; // Base64-encoded image
  };
};

type Template = {
  id: number;
  status: number;
  statusCode: string;
  orgId: number;
  orgSlug: string;
  orgName: string;
  slug: string;
  downloads: number;
  revisionId: number;
  revision: number;
  name: string;
  description: string;
  readme: string;
  collectorType: string | null; // Examples: "nodeExporter"
  collectorConfig: string | null; // Stringified configuration or descriptive text
  collectorPluginList: string | null; // Examples: "conntrack"
  datasource: string; // Example: "Prometheus"
  privacy: string; // Example: "public"
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  isEditor: boolean;
  hasLogo: boolean;
  reviewsCount: number;
  reviewsAvgRating: number;
  links: Link[];
  datasourceSlugs: string[];
  screenshots?: Screenshot[]; // Optional array of screenshots
  logos?: Logo; // Optional logo details
};
interface GnetAPIResponse {
  items: Template[];
  orderBy: string;
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}

interface UseTemplateDashboardOptions {
  sortBy: SortBy;
  page: number;
  filter: string;
}

function useTemplateDashboards({ sortBy, page, filter }: UseTemplateDashboardOptions) {
  const {
    value: response,
    loading,
    error,
  } = useAsync(async () => {
    return await getBackendSrv().get<GnetAPIResponse>(
      `/api/gnet/dashboards?orderBy=${sortBy}&direction=${sortByDir[sortBy]}&page=${page}&pageSize=30&includeLogo=1&includeScreenshots=true&filter=${filter}`
    );
  }, [sortBy, page, filter]);

  return {
    dashboards: response ? response.items : null,
    loading,
    error,
    pages: response ? response.pages : 0,
    total: response ? response.total : 0,
    page: response ? response.page : 0,
  };
}

interface TemplateListProps {}

type SortBy = 'downloads' | 'reviewsAvgRating' | 'name' | 'updatedAt' | 'reviewsCount';
type SortByDirection = 'asc' | 'desc';
type SortByOption = { label: string; value: SortBy };

const sortByOptions: SortByOption[] = [
  { label: 'Downloads', value: 'downloads' },
  { label: 'Rating', value: 'reviewsAvgRating' },
  { label: 'Name', value: 'name' },
  { label: 'Last Updated', value: 'updatedAt' },
  { label: 'Number of reviews', value: 'reviewsCount' },
];
const sortByDir: Record<SortBy, SortByDirection> = {
  downloads: 'desc',
  reviewsAvgRating: 'desc',
  name: 'asc',
  updatedAt: 'desc',
  reviewsCount: 'desc',
};

function TemplateList({}: TemplateListProps) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(sortByOptions[0].value);
  const [filter, setFilter] = useState('');
  const { dashboards, pages, loading, error, page: currentPage } = useTemplateDashboards({ sortBy, page, filter });

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
            options={sortByOptions}
            isSearchable={false}
          />
        </Box>
      </Stack>
      {error && <div>Error loading dashboards</div>}
      {dashboards && dashboards.length > 0 ? (
        <>
          <Grid columns={3} gap={2} alignItems="stretch">
            {dashboards.map((d) => (
              <TemplateItem key={d.slug} dashboard={d} />
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
    </Stack>
  );
}

interface TemplateItemProps {
  dashboard: Template;
}

function TemplateItem({ dashboard }: TemplateItemProps) {
  const getThumbnailUrl = () => {
    const thumbnail = dashboard.screenshots?.[0]?.links.find((l) => l.rel === 'image')?.href ?? '';
    return thumbnail ? `/api/gnet${thumbnail}` : '';
  };

  const styles = useStyles2(getStylesTemplateItem);
  const thumbnailUrl = getThumbnailUrl();

  return (
    <div className={styles.container}>
      <Box display="flex" direction="column" backgroundColor="secondary" paddingBottom={2} height="100%">
        <Box display="flex" height="200px">
          {thumbnailUrl ? (
            <img className={styles.img} src={getThumbnailUrl()} alt="Screenshot" />
          ) : (
            <Box
              backgroundColor="secondary"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flex="1"
              height="200px"
            >
              No image
            </Box>
          )}
        </Box>
        <Box paddingY={1} paddingX={1}>
          <Stack direction="column">
            <Text variant="h4">{dashboard.name}</Text>
            <Text variant="body" color="secondary">
              {dashboard.description}
            </Text>
            <Text variant="body" color="secondary" weight="bold">
              {dashboard.datasource}
            </Text>
          </Stack>
        </Box>
        <Box
          display="flex"
          direction="row"
          paddingX={1}
          alignItems="center"
          justifyContent="space-between"
          minWidth="100%"
        >
          <Stack direction="column" gap={0}>
            <Text variant="body">
              {dashboard.reviewsAvgRating} <Text color="warning">✮</Text>
            </Text>
            <Text variant="body" color="secondary">
              {locale(dashboard.reviewsCount, 0).text} Reviews
            </Text>
          </Stack>
          <Stack direction="column" gap={0}>
            <Text variant="body">{locale(dashboard.reviewsCount, 0).text}</Text>
            <Text variant="body" color="secondary">
              Downloads
            </Text>
          </Stack>
          <Stack direction="column" gap={0}>
            <Text variant="body">{dashboard.revision}</Text>
            <Text variant="body" color="secondary">
              Version
            </Text>
          </Stack>
        </Box>
      </Box>
    </div>
  );
}

function getStylesTemplateItem() {
  return {
    container: css({
      borderRadius: 24,
      overflow: 'hidden',
    }),
    img: css({
      objectFit: 'cover',
      objectPosition: 'top-left',
      minWidth: '100%',
    }),
  };
}

function TemplateListPage() {
  const navModelItem = { text: 'Import dashboard', subTitle: 'Import dashboard from file or Grafana.com' };

  return (
    <Page navId="dashboards/browse" pageNav={navModelItem}>
      <Page.Contents>
        <TemplateList />
      </Page.Contents>
    </Page>
  );
}

export default TemplateListPage;
