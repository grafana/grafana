import { getBackendSrv } from '@grafana/runtime';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

type PreviewsState = {
  systemRequirements: {
    met: boolean;
    requiredImageRendererPluginVersion?: string;
  };
};

export const initialState: PreviewsState = {
  systemRequirements: {
    met: true,
  },
};

export const getSystemRequirements = createAsyncThunk('previews/getSystemRequirements', async () => {
  const res = await getBackendSrv().get(`api/dashboards/previews/system-requirements`);
  return res as PreviewsState['systemRequirements'];
});

const previewsSlice = createSlice({
  name: 'previews',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getSystemRequirements.fulfilled, (state, action) => {
      const payload = action.payload;
      if (!payload) {
        return;
      }

      state.systemRequirements = payload;
    });
  },
});

export const previewsReducers = previewsSlice.reducer;

export default {
  previews: previewsReducers,
};
