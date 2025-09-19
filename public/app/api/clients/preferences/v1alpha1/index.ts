import { generatedAPI } from './endpoints.gen';

export const iamAPIv0alpha1 = generatedAPI.enhanceEndpoints({});

export const { useGetStarsQuery, useAddStarMutation, useRemoveStarMutation } = generatedAPI;
