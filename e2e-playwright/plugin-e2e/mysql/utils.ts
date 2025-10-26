import { PlaywrightTestArgs } from '@playwright/test';

import { PluginFixture } from '@grafana/plugin-e2e';

import { datasetResponse, fieldsResponse, tablesResponse } from './mocks/mysql.mocks';

export async function mockDataSourceRequest({ context, explorePage, selectors }: PlaywrightTestArgs & PluginFixture) {
  await explorePage.datasource.set('gdev-mysql');
  await context.route(selectors.apis.DataSource.queryPattern, async (route, request) => {
    const refId = request.postDataJSON().queries[0].refId;
    if (/fields-.*/g.test(refId)) {
      return route.fulfill({ json: fieldsResponse(refId), status: 200 });
    }
    switch (refId) {
      case 'tables':
        return route.fulfill({ json: tablesResponse, status: 200 });
      case 'datasets':
        return route.fulfill({ json: datasetResponse, status: 200 });
      default:
        return route.continue();
    }
  });
}
