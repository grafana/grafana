import { throttle } from 'lodash';
import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { NavModelItem, PageLayoutType } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Alert, Box, Icon, Input, LoadingPlaceholder } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { DashboardDataDTO } from 'app/types';

import { EmbeddedDashboard } from '../dashboard-scene/embedding/EmbeddedDashboard';

import { DashboardJSON } from './components/DashboardJSON';
import { TemplateGallery } from './components/TemplateGallery/TemplateGallery';

type TemplatesResponse = Result[];

interface Result {
  payload: {
    metadata: DashboardDataDTO;
  };
  score: number;
}

const pageNav: NavModelItem = {
  text: 'Template gallery',
  subTitle: 'Create a dashboard from a template or an existing dashboard',
};

export const TemplateGalleryPage = () => {
  const [search, setSearch] = useState('');
  const [schema, setSchema] = useState<DashboardDataDTO | null>(null);

  // Throttle search
  const onSearch = throttle((value: string) => {
    setSearch(value);
  }, 2000);

  const { loading, dashboards, error } = useTemplateDB(search);

  return (
    <Page navId="dashboard/templates" pageNav={pageNav} layout={PageLayoutType.Canvas}>
      <Page.Contents>
        {error && <Alert title="Error retrieving the templates">{error.toString()}</Alert>}
        <Box marginBottom={1}>
          <Input
            prefix={<Icon name="search" />}
            placeholder="Search templates"
            value={search}
            onChange={(e) => onSearch(e.currentTarget.value)}
            loading={loading}
          ></Input>
        </Box>
        <Box>
          <TemplateGallery
            items={dashboards ?? []}
            onClickItem={(item) => {
              setSchema(item);
            }}
          ></TemplateGallery>
        </Box>
        <Box>{schema && <DashboardJSON schema={schema} />}</Box>
      </Page.Contents>
    </Page>
  );
};

export default TemplateGalleryPage;

const useTemplateDB = (search: string) => {
  const { loading, value, error } = useAsync(async () => {
    const backendSrv = getBackendSrv();
    const result = await backendSrv.post<TemplatesResponse>(
      'http://localhost:8889/v1/collections/plugin_templates/search',
      {
        input: search ?? '',
        top_k: 10,
      }
    );
    const dashboards = result.map(({ payload, score }) => payload.metadata);

    return dashboards;
  }, [search]);

  return { loading, dashboards: value ?? [], error };
};
