## Generating RTK Query API Clients

To show the steps to follow, we are going to work on adding an API client to create a new dashboard. Just adapt the following guide to your use case.

### 1. Generate an OpenAPI snapshot

First, check if the `group` and the `version` are already present in [openapi_test.go](/pkg/tests/apis/openapi_test.go). If so, move on to the next step.
<br/> If you need to add a new block, you can check for the right `group` and `version` in the backend API call that you want to replicate in the frontend.

```jsx
{
  Group:   "dashboard.grafana.app",
  Version: "v0alpha1",
}
```

Afterwards, you need to run the `TestIntegrationOpenAPIs` test. Note that it will fail the first time you run it. On the second run, it will generate the corresponding OpenAPI spec, which you can find in [openapi_snapshots](/pkg/tests/apis/openapi_snapshots).
<br/>
<br/>

> Note: You don’t need to follow these two steps if the `group` you’re working with is already in the `openapi_test.go` file.

<br/>

### 2. Create the API definition

In the `../public/app/features/{your_group_name}/api/` folder you have to create the `baseAPI.ts` file for your group. This file should have the following content:

```jsx
import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

export const BASE_URL = getAPIBaseURL('dashboard.grafana.app', 'v0alpha1');

export const baseAPI = createApi({
  reducerPath: 'dashboardAPI',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
```

This is the API definition for the specific group you're working with, where `getAPIBaseURL` should have the proper `group` and `version` as parameters. The `reducePath` should also be modified to match `group + API`: `dashboard` will be `dashboardAPI`, `iam` will be `iamAPI` and so on.

### 3. Add the output information

Open [generate-rtk-apis.ts](scripts/generate-rtk-apis.ts) and add the following information:

| Data            | Descritpion                                                                                                                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| outputFile name | File that will be created after running the API Client Generation script. It is the key of the object.                                                                                                                                                                                    |
| apiFile         | File with the group's API definition.                                                                                                                                                                                                                                                     |
| schemaFile      | File with the schema that was automatically created in the second step. Although it is in openapi_snapshots, you should link the one saved in `data/openapi`.                                                                                                                             |
| apiImport       | Function name exported in the API definition (baseAPI.ts file).                                                                                                                                                                                                                           |
| filterEndpoints | The `operationId` of the particular route you want to work with. You can check the available operationIds in the specific group's spec file. As seen in the `migrate-to-cloud` one, it is an array                                                                                        |
|  tag            | Must be set to `true`, to automatically attach tags to endpoints. This is needed for proper cache invalidation. See more info in the [official documentation](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching#:~:text=RTK%20Query%20uses,an%20active%20subscription.).  |

<br/>

> More info in [Redux Toolkit](https://redux-toolkit.js.org/rtk-query/usage/code-generation#simple-usage)

In our example, the information added will be:

```jsx
'../public/app/features/dashboard/api/endpoints.gen.ts': {
    apiFile: '../public/app/features/dashboard/api/baseAPI.ts',
    schemaFile: '../data/openapi/dashboard.grafana.app-v0alpha1.json',
    apiImport: 'baseAPI',
    filterEndpoints: ['createDashboard', 'updateDashboard'],
    tag: true,
},
```

### 4. Run the API Client script

Then, we are ready to run the script to create the API client:

```jsx
yarn generate-apis
```

This will create an `endpoints.gen.ts` file in the path specified in the previous step.

### 5. Create the index file for your hooks

In the same `api` folder where the `endpoints.gen.ts` file has been saved, you have to create an index file from which you can import the types and hooks needed. By doing this, we selectively export hooks/types from `endpoints.gen.ts`.

In our case, the dashboard index will be like:

```jsx
import { generatedAPI } from './endpoints.gen';

export const dashboardAPI = generatedAPI;
export const { useCreateDashboardMutation, useUpdateDashboardMutation} = dashboardAPI;
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Dashboard } from './endpoints.gen';

```

There are some use cases where the hook will not work, and that is a clue to see if it needs to be modified. The hooks can be tweaked by using `enhanceEndpoints`.

```jsx
export const dashboardsAPI = generatedApi.enhanceEndpoints({
  endpoints: {
    // Need to mutate the generated query to set the Content-Type header correctly
    updateDashboard: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) => ({
          ...originalQuery(requestOptions),
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
        });
      }
    },
  },
});
```

### 6. Add reducers and middleware to the Redux store

Last but not least, you need to add the middleware and reducers to the store.

In Grafana, the reducers are added to [`root.ts`](public/app/core/reducers/root.ts):

```jsx
  import { dashboardAPI } from '<pathToYourAPI>';
  const rootReducers = {
    ...,
    [dashboardAPI.reducerPath]: dashboardAPI.reducer,
  };
```

And the middleware is added to [`configureStore.ts`](public/app/store/configureStore.ts):

```jsx
import { dashboardAPI } from '<pathToYourAPI>';
export function configureStore(initialState?: Partial<StoreState>) {
  const store = reduxConfigureStore({
    reducer: createRootReducer(),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: true, serializableCheck: false, immutableCheck: false }).concat(
        ...,
        dashboardAPI.middleware
      ),
    ...,
  });
```

You have available the official documentation in [RTK Query](https://redux-toolkit.js.org/tutorials/rtk-query#add-the-service-to-your-store)

After this step is done, it is time to use your hooks across Grafana.
Enjoy coding!
