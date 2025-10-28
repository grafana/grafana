import { generatedAPI } from '@grafana/api-clients/rtkq/iam/v0alpha1';

export const iamAPIv0alpha1 = generatedAPI.enhanceEndpoints({});

export const { useGetDisplayMappingQuery, useLazyGetDisplayMappingQuery } = iamAPIv0alpha1;
