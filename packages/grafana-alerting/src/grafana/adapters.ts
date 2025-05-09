import { alertingAPI as alertingAPIv0alpha1 } from './api/v0alpha1/api.gen';
import type { ContactPoint as ContactPoint_v0alpha1 } from './api/v0alpha1/types';
import { type ContactPointAdapter, type GenericContactPoint } from './contactPoints/types';
import { getContactPointDescription } from './contactPoints/utils';

export const v0alpha1ContactPointAdapter: ContactPointAdapter<ContactPoint_v0alpha1> = {
  useListContactPoints: () => {
    const result = alertingAPIv0alpha1.useListReceiverQuery({}); // Assuming this is the v0alpha1 hook
    return {
      data: result.currentData?.items,
      isLoading: result.isLoading,
      error: result.error,
    };
  },
  // TODO Fix grafana apiserver types
  // @ts-expect-error
  toGenericContactPoint: (apiCp: ContactPoint_v0alpha1): GenericContactPoint => ({
    uid: apiCp.metadata.uid ?? apiCp.spec.title,
    title: apiCp.spec.title,
    description: getContactPointDescription(apiCp),
  }),
};
