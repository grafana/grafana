import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { ServicesService } from 'app/percona/shared/services/services/Services.service';
import { Service, ServiceType } from 'app/percona/shared/services/services/Services.types';
import { createAsyncThunk } from 'app/types';

import { filterFulfilled, processPromiseResults } from '../../../helpers/promises';

import {
  ListServicesParams,
  RemoveServiceParams,
  RemoveServicesParams,
  ServicesState,
  UpdateServiceParams,
} from './services.types';
import {
  didStandardLabelsChange,
  hasLabelsToAddOrUpdate,
  hasLabelsToRemove,
  toCustomLabelsBodies,
  toDbServicesModel,
  toListServicesBody,
  toRemoveServiceBody,
  toUpdateServiceBody,
} from './services.utils';

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
    const response = await ServicesService.getActive(undefined, true);
    return response.service_types || [];
  }
);

export const fetchServicesAction = createAsyncThunk<Service[], Partial<ListServicesParams>>(
  'percona/fetchServices',
  async (params = {}) => {
    const body = toListServicesBody(params);
    const payload = await ServicesService.getServices(body, params.token);
    const mappedServices = toDbServicesModel(payload);
    return mappedServices.sort((a, b) => a.params.serviceName.localeCompare(b.params.serviceName));
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

export const removeServiceAction = createAsyncThunk(
  'percona/removeServices',
  async (params: RemoveServiceParams, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        const body = toRemoveServiceBody(params);
        await ServicesService.removeService(body);

        thunkAPI.dispatch(fetchServicesAction({}));
        thunkAPI.dispatch(fetchActiveServiceTypesAction());
      })()
    )
);

export const updateServiceAction = createAsyncThunk('percona/updateService', (params: UpdateServiceParams, thunkAPI) =>
  withSerializedError(
    (async (): Promise<void> => {
      const updateBody = toUpdateServiceBody(params);
      const [addLabelsBody, removeLabelsBody] = toCustomLabelsBodies(params);
      const requests: Array<Promise<{}>> = [];

      if (didStandardLabelsChange(params)) {
        requests.push(ServicesService.updateService(updateBody));
      }

      if (hasLabelsToAddOrUpdate(addLabelsBody)) {
        requests.push(ServicesService.addCustomLabels(addLabelsBody));
      }

      if (hasLabelsToRemove(removeLabelsBody)) {
        requests.push(ServicesService.removeCustomLabels(removeLabelsBody));
      }

      await Promise.all(requests);

      thunkAPI.dispatch(fetchServicesAction({}));
    })()
  )
);

export default servicesSlice.reducer;
