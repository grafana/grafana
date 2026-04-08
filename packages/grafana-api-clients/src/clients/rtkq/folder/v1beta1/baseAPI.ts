import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';

import { FOLDER_API_GROUP, getFolderAPIBaseURL } from './folderApiVersionResolver';

export const API_GROUP = FOLDER_API_GROUP;

/** OpenAPI / codegen source version; negotiated runtime version may be `v1`. */
export const API_VERSION = 'v1beta1' as const;

/** Static v1beta1 base URL for tooling and tests; runtime requests use negotiated version via {@link getFolderAPIBaseURL}. */
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: 'folderAPIv1beta1',
  baseQuery: createBaseQuery({
    getBaseURL: getFolderAPIBaseURL,
  }),
  endpoints: () => ({}),
});
