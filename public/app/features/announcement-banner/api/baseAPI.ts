import { createApi } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { createBaseQuery } from 'app/api/createBaseQuery';

export const baseAPI = createApi({
  reducerPath: 'announcementBannerGeneratedAPI',
  baseQuery: createBaseQuery({
    baseURL: `/apis/banners.grafana.app/v0alpha1/namespaces/${config.namespace}`,
  }),
  tagTypes: ['AnnouncementBannerList'],
  endpoints: () => ({}),
});
