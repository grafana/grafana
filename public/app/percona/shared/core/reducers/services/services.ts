import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { ServicesService } from 'app/percona/shared/services/services/Services.service';
import { Service, ServiceType } from 'app/percona/shared/services/services/Services.types';
import { createAsyncThunk } from 'app/types';

import { filterFulfilled, processPromiseResults } from '../../../helpers/promises';

import { ListServicesParams, RemoveServicesParams, ServicesState } from './services.types';
import { toDbServicesModel, toListServicesBody, toRemoveServiceBody } from './services.utils';

const initialState: ServicesState = {
  activeTypes: [],
  services: [],
  isLoading: false,
};

const servicesSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {
    setServices: (state, action: PayloadAction<Service[]>): ServicesState => ({
      ...state,
      services: action.payload,
    }),
    setLoading: (state, action: PayloadAction<boolean>): ServicesState => ({
      ...state,
      isLoading: action.payload,
    }),
  },
  extraReducers: (builder) => {
    builder.addCase(fetchServicesAction.pending, (state) => ({
      ...state,
      isLoading: true,
    }));
    builder.addCase(fetchServicesAction.rejected, (state) => ({
      ...state,
      isLoading: false,
    }));
    builder.addCase(fetchServicesAction.fulfilled, (state, action) => ({
      ...state,
      services: action.payload,
      isLoading: false,
    }));
    builder.addCase(fetchActiveServiceTypesAction.fulfilled, (state, action) => ({
      ...state,
      activeTypes: action.payload,
    }));
  },
});

export const { setServices, setLoading } = servicesSlice.actions;

export const fetchActiveServiceTypesAction = createAsyncThunk<ServiceType[]>(
  'percona/fetchActiveServiceTypes',
  async () => {
    const response = await ServicesService.getActive();
    return response.service_types || [];
  }
);

export const fetchServicesAction = createAsyncThunk<Service[], Partial<ListServicesParams>>(
  'percona/fetchServices',
  async (params = {}) => {
    const body = toListServicesBody(params);
    const payload = await ServicesService.getServices(body, params.token);

    return toDbServicesModel(payload);
  }
);

export const removeServicesAction = createAsyncThunk(
  'percona/removeServices',
  async (params: RemoveServicesParams): Promise<number> => {
    const bodies = params.services.map(toRemoveServiceBody);
    const requests = bodies.map((body) => ServicesService.removeService(body, params.cancelToken));
    const results = await processPromiseResults(requests);
    return results.filter(filterFulfilled).length;
  }
);

export default servicesSlice.reducer;
