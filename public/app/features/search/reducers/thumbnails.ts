import { getBackendSrv } from '@grafana/runtime';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

type ThemeName = 'dark' | 'light';
type DashboardUid = string;

type ThumbnailsState = Record<DashboardUid, Record<ThemeName, { loaded: boolean; imageSrc: string | undefined }>>;
export const initialState: ThumbnailsState = {};

export const getThumbnailURL = (uid: string, themeName: ThemeName) =>
  `/api/dashboards/uid/${uid}/img/thumb/${themeName}`;

export type GetThumbnailResponse = {
  imageDataUrl?: string;
};

export const fetchThumbnail = createAsyncThunk(
  'thumbnails/fetch',
  async (req: { dashboardUid: string; themeName: ThemeName }) => {
    const url = getThumbnailURL(req.dashboardUid, req.themeName);

    const res: GetThumbnailResponse = await getBackendSrv().get(url);
    return { ...req, imageSrc: res.imageDataUrl };
  }
);

export const updateThumbnail = createAsyncThunk(
  'thumbnails/update',
  async (req: { dashboardUid: string; themeName: ThemeName; file: File }, api) => {
    const formData = new FormData();
    formData.append('file', req.file);
    try {
      const res = await fetch(getThumbnailURL(req.dashboardUid, req.themeName), {
        method: 'POST',
        body: formData,
      });
      if (res.status !== 200) {
        const body = await res.json();
        console.log(`error: ${res.status} ${JSON.stringify(body)}`);
        return;
      }

      api.dispatch(fetchThumbnail({ dashboardUid: req.dashboardUid, themeName: req.themeName }));
    } catch (err) {
      console.log('error ', err.stack);
    }
  }
);

const thumbsSlice = createSlice({
  name: 'thumbs',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchThumbnail.fulfilled, (state, action) => {
      if (!action.payload) {
        return;
      }
      const { imageSrc, dashboardUid, themeName } = action.payload;
      const thumbsForDashboard = state[dashboardUid] ?? {};
      state[dashboardUid] = { ...thumbsForDashboard, [themeName]: { loaded: true, imageSrc } };
    });
  },
});

export const thumbsReducers = thumbsSlice.reducer;

export default {
  thumbs: thumbsReducers,
};
