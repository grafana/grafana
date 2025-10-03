import { generatedAPI } from './endpoints.gen';

export const advisorAPIv0alpha1 = generatedAPI.enhanceEndpoints({});
export const {
  useGetCheckQuery,
  useListCheckQuery,
  useCreateCheckMutation,
  useDeleteCheckMutation,
  useUpdateCheckMutation,
  useListCheckTypeQuery,
  useUpdateCheckTypeMutation,
} = advisorAPIv0alpha1;
export { type Check, type CheckType } from './endpoints.gen'; // eslint-disable-line
