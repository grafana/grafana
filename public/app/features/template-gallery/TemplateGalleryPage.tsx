import { throttle } from 'lodash';
import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Alert, Input, LoadingPlaceholder } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { DashboardDataDTO } from 'app/types';

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

  // Throttle search
  const onSearch = throttle((value: string) => {
    setSearch(value);
  }, 1000);

  const { loading, dashboards, error } = useTemplateDB(search);

  return (
    <Page navId="dashboard/templates" pageNav={pageNav}>
      <Page.Contents>
        {error && <Alert title="Error retrieving the templates">{error.toString()}</Alert>}
        <Input placeholder="Search templates" value={search} onChange={(e) => onSearch(e.currentTarget.value)}></Input>
        {loading ? (
          <LoadingPlaceholder text="Finding a good template for your use case" />
        ) : (
          <TemplateGallery items={dashboards ?? []}></TemplateGallery>
        )}
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
