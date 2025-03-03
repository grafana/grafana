import { useCallback } from 'react';

import {
  useCreateAnnouncementBannerMutation,
  useListAnnouncementBannerQuery,
  useReplaceAnnouncementBannerMutation,
  AnnouncementBanner,
  Spec,
} from './api';

export function useCreateOrUpdateBanner(name?: string) {
  const [create, createRequest] = useCreateAnnouncementBannerMutation();
  const [update, updateRequest] = useReplaceAnnouncementBannerMutation();

  const updateOrCreate = useCallback(
    (data: Spec) => {
      if (name) {
        return update({ name, announcementBanner: { metadata: { name }, spec: data } });
      }
      return create({ announcementBanner: { metadata: { generateName: 'banner' }, spec: data } });
    },
    [create, name, update]
  );
  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}

export function useBanner(): [AnnouncementBanner | undefined, boolean] {
  const query = useListAnnouncementBannerQuery({});
  // Sort banners by resourceVersion to show the last modified
  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    return Number(b.metadata?.resourceVersion) - Number(a.metadata?.resourceVersion);
  });

  return [sortedItems?.[0], query.isLoading];
}
