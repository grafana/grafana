import { configureStore } from '@reduxjs/toolkit';

import { stateSlice } from './state';

export default configureStore({
  reducer: {
    reducer: stateSlice.reducer,
  },
});
