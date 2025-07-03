import { generatedAPI } from './endpoints.gen';

import { PAGE_SIZE } from '../../../../features/browse-dashboards/api/services';
import { refetchChildren } from '../../../../features/browse-dashboards/state';
import { GENERAL_FOLDER_UID } from '../../../../features/search/constants';

import { generatedAPI } from './endpoints.gen';

export const folderAPIv1beta1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    deleteFolder: {
      onQueryStarted: (args, { queryFulfilled, dispatch }) => {
        // Refetch for anything using the old API.
        queryFulfilled.then(() => {
          dispatch(
            refetchChildren({
              parentUID: GENERAL_FOLDER_UID,
              pageSize: PAGE_SIZE,
            })
          );
        });
      },
    },
  },
});

export const { useGetFolderQuery } = folderAPIv1beta1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Folder, type GetFolderChildrenApiResponse } from './endpoints.gen';
