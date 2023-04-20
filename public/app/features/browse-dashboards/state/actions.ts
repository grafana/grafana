import { createAsyncThunk } from '@reduxjs/toolkit';

import { getFolderChildren } from 'app/features/search/service/folders';

export const fetchChildren = createAsyncThunk(
  'browseDashboards/fetchChildren',
  async (parentUID: string | undefined) => {
    return await getFolderChildren(parentUID, undefined, true);
  }
);
