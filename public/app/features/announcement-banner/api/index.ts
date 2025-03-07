import { generatedAPI } from './endpoints.gen';

export const announcementBannerAPI = generatedAPI.enhanceEndpoints({});

export const {
  useListAnnouncementBannerQuery,
  useCreateAnnouncementBannerMutation,
  useReplaceAnnouncementBannerMutation,
  useDeleteAnnouncementBannerMutation,
} = announcementBannerAPI;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Spec, type AnnouncementBanner } from './endpoints.gen';
