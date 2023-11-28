import { __awaiter } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { ServicesService } from 'app/percona/shared/services/services/Services.service';
import { createAsyncThunk } from 'app/types';
import { filterFulfilled, processPromiseResults } from '../../../helpers/promises';
import { didStandardLabelsChange, hasLabelsToAddOrUpdate, hasLabelsToRemove, toCustomLabelsBodies, toDbServicesModel, toListServicesBody, toRemoveServiceBody, toUpdateServiceBody, } from './services.utils';
const initialState = {
    activeTypes: [],
    services: [],
    isLoading: false,
};
const servicesSlice = createSlice({
    name: 'services',
    initialState,
    reducers: {
        setServices: (state, action) => (Object.assign(Object.assign({}, state), { services: action.payload })),
        setLoading: (state, action) => (Object.assign(Object.assign({}, state), { isLoading: action.payload })),
    },
    extraReducers: (builder) => {
        builder.addCase(fetchServicesAction.pending, (state) => (Object.assign(Object.assign({}, state), { isLoading: true })));
        builder.addCase(fetchServicesAction.rejected, (state) => (Object.assign(Object.assign({}, state), { isLoading: false })));
        builder.addCase(fetchServicesAction.fulfilled, (state, action) => (Object.assign(Object.assign({}, state), { services: action.payload, isLoading: false })));
        builder.addCase(fetchActiveServiceTypesAction.fulfilled, (state, action) => (Object.assign(Object.assign({}, state), { activeTypes: action.payload })));
    },
});
export const { setServices, setLoading } = servicesSlice.actions;
export const fetchActiveServiceTypesAction = createAsyncThunk('percona/fetchActiveServiceTypes', () => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield ServicesService.getActive(undefined, true);
    return response.service_types || [];
}));
export const fetchServicesAction = createAsyncThunk('percona/fetchServices', (params = {}) => __awaiter(void 0, void 0, void 0, function* () {
    const body = toListServicesBody(params);
    const payload = yield ServicesService.getServices(body, params.token);
    const mappedServices = toDbServicesModel(payload);
    return mappedServices.sort((a, b) => a.params.serviceName.localeCompare(b.params.serviceName));
}));
export const removeServicesAction = createAsyncThunk('percona/removeServices', (params) => __awaiter(void 0, void 0, void 0, function* () {
    const bodies = params.services.map(toRemoveServiceBody);
    const requests = bodies.map((body) => ServicesService.removeService(body, params.cancelToken));
    const results = yield processPromiseResults(requests);
    return results.filter(filterFulfilled).length;
}));
export const removeServiceAction = createAsyncThunk('percona/removeServices', (params, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        const body = toRemoveServiceBody(params);
        yield ServicesService.removeService(body);
        thunkAPI.dispatch(fetchServicesAction({}));
        thunkAPI.dispatch(fetchActiveServiceTypesAction());
    }))());
}));
export const updateServiceAction = createAsyncThunk('percona/updateService', (params, thunkAPI) => withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    const updateBody = toUpdateServiceBody(params);
    const [addLabelsBody, removeLabelsBody] = toCustomLabelsBodies(params);
    const requests = [];
    if (didStandardLabelsChange(params)) {
        requests.push(ServicesService.updateService(updateBody));
    }
    if (hasLabelsToAddOrUpdate(addLabelsBody)) {
        requests.push(ServicesService.addCustomLabels(addLabelsBody));
    }
    if (hasLabelsToRemove(removeLabelsBody)) {
        requests.push(ServicesService.removeCustomLabels(removeLabelsBody));
    }
    yield Promise.all(requests);
    thunkAPI.dispatch(fetchServicesAction({}));
}))()));
export default servicesSlice.reducer;
//# sourceMappingURL=services.js.map