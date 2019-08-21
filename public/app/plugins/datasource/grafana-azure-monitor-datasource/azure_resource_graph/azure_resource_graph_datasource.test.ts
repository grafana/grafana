import AzureResourceGraphDatasource from '../datasource';
import { AzureSubscription, AzureSubscriptions } from './azure_resource_graph_datasource';
// @ts-ignore
import Q from 'q';
import { TemplateSrv } from 'app/features/templating/template_srv';

const SUBSCRIPTION_ID_DUMMY_01 = `99999999-cccc-bbbb-aaaa-9106972f9572`;
const TENANT_ID_DUMMY_01 = `99999999-aaaa-bbbb-cccc-51c4f982ec48`;
const RESPONSE_SUBSCRIPTIONS_01 = {
  data: {
    value: [
      {
        id: `/subscriptions/${SUBSCRIPTION_ID_DUMMY_01}`,
        subscriptionId: `${SUBSCRIPTION_ID_DUMMY_01}`,
        tenantId: `${TENANT_ID_DUMMY_01}`,
        displayName: 'Primary Subscription',
        state: 'Enabled',
        subscriptionPolicies: {
          locationPlacementId: 'Public_2014-09-01',
          quotaId: 'PayAsYouGo_2014-09-01',
          spendingLimit: 'Off',
        },
        authorizationSource: 'RoleBased',
      },
    ],
    count: {
      type: 'Total',
      value: 1,
    },
  },
  status: 200,
  statusText: 'OK',
};
const ctx: any = {
  backendSrv: {},
  templateSrv: new TemplateSrv(),
  $q: Q,
  instanceSettings: {
    url: 'http://azuremonitor.com',
    jsonData: { subscriptionId: `${SUBSCRIPTION_ID_DUMMY_01}` },
    cloudName: 'azuremonitor',
  },
};

describe('AzureSubscription', () => {
  describe('Subscription class', () => {
    it('Subcription', () => {
      const subscription = new AzureSubscription(RESPONSE_SUBSCRIPTIONS_01.data.value[0]);
      expect(subscription.subscriptionId).toBe(`${SUBSCRIPTION_ID_DUMMY_01}`);
    });
  });
  describe('Subscription response parser', () => {
    it('Subscriptions count', () => {
      const subscriptionsResponse = new AzureSubscriptions(RESPONSE_SUBSCRIPTIONS_01);
      expect(subscriptionsResponse.subscriptions.length).toBe(RESPONSE_SUBSCRIPTIONS_01.data.value.length);
      expect(subscriptionsResponse.subscriptions[0].subscriptionId).toBe(`${SUBSCRIPTION_ID_DUMMY_01}`);
      expect(subscriptionsResponse.getSubscriptionIds().length).toBe(RESPONSE_SUBSCRIPTIONS_01.data.value.length);
      expect(subscriptionsResponse.getSubscriptionIds()[0]).toBe(`${SUBSCRIPTION_ID_DUMMY_01}`);
    });
  });
});

describe('AzureResourceGraphDatasource', () => {
  describe('Resource Graph', () => {
    describe('When performing a query', () => {
      describe('Single field query', () => {
        const options = {
          targets: [
            {
              queryType: 'Azure Resource Graph',
              hide: false,
              azureResourceGraph: {
                query: 'count',
                top: 100,
                skip: 0,
              },
            },
          ],
        };
        const response: any = {
          totalRecords: 1,
          count: 1,
          data: {
            columns: [{ name: 'Count', type: 'integer' }],
            rows: [[55542]],
          },
          facets: [],
          resultTruncated: 'false',
        };
        beforeEach(() => {
          ctx.backendSrv.datasourceRequest = () => {
            return ctx.$q.when({ data: response, status: 200 });
          };
          ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
        });
        it('Output should be table format', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].type).toBe('table');
          });
        });
        it('Output should contain result', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].rows[0][0]).toBe(55542);
          });
        });
      });
      describe('Multi fields query', () => {
        const options = {
          targets: [
            {
              queryType: 'Azure Resource Graph',
              hide: false,
              azureResourceGraph: {
                query: 'summarize count=count() by type',
                top: 100,
                skip: 0,
              },
            },
          ],
        };
        const response: any = {
          totalRecords: 3,
          count: 3,
          data: {
            columns: [{ name: 'type', type: 'string' }, { name: 'count', type: 'integer' }],
            rows: [
              ['microsoft.network/publicipaddresses', 1155],
              ['microsoft.compute/virtualmachines', 2200],
              ['microsoft.sql/managedinstances/databases', 5],
            ],
          },
          facets: [],
          resultTruncated: 'true',
        };
        beforeEach(() => {
          ctx.backendSrv.datasourceRequest = () => {
            return ctx.$q.when({ data: response, status: 200 });
          };
          ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
        });
        it('Output should be table format', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].type).toBe('table');
          });
        });
        it('Output should valid number of columns results', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].columns.length).toBe(2);
          });
        });
        it('Output should valid column results', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].columns[0].text).toBe('type');
          });
        });
        it('Output should valid number of results', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].rows.length).toBe(3);
          });
        });
        it('Output row should have valid length', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].rows[0].length).toBe(2);
          });
        });
        it('Output should contain result', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].rows[1][1]).toBe(2200);
          });
        });
      });
      describe('Multi fields query with multiple targets', () => {
        const options = {
          targets: [
            {
              queryType: 'Azure Resource Graph',
              hide: false,
              azureResourceGraph: {
                query: 'where location == "northeurope" | summarize count=count() by location',
                top: 100,
                skip: 0,
              },
            },
            {
              queryType: 'Azure Resource Graph',
              hide: false,
              azureResourceGraph: {
                query: 'where location == "westeurope" | summarize count=count() by location',
                top: 100,
                skip: 0,
              },
            },
          ],
        };
        const response: any = {
          totalRecords: 1,
          count: 1,
          data: {
            columns: [{ name: 'type', type: 'string' }, { name: 'count', type: 'integer' }],
            rows: [['northeurope', 1155]],
          },
          facets: [],
          resultTruncated: 'true',
        };
        beforeEach(() => {
          ctx.backendSrv.datasourceRequest = () => {
            return ctx.$q.when({ data: response, status: 200 });
          };
          ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
        });
        it('Output should be table format', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].type).toBe('table');
          });
        });
        it('Output should valid number of columns results', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].columns.length).toBe(2);
          });
        });
        it('Output should valid column results', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].columns[0].text).toBe('type');
          });
        });
        it('Output should valid number of results', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].rows.length).toBe(2);
          });
        });
        it('Output row should have valid length', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].rows[0].length).toBe(2);
          });
        });
        it('Output should contain result', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0].rows[1][1]).toBe(1155);
          });
        });
      });
      describe('Disabled query', () => {
        const options = {
          targets: [
            {
              queryType: 'Azure Resource Graph',
              hide: true,
              azureResourceGraph: {
                query: 'count',
                top: 100,
                skip: 0,
              },
            },
          ],
        };
        const response: any = {
          totalRecords: 1,
          count: 1,
          data: {
            columns: [{ name: 'Count', type: 'integer' }],
            rows: [[55542]],
          },
          facets: [],
          resultTruncated: 'false',
        };
        beforeEach(() => {
          ctx.backendSrv.datasourceRequest = () => {
            return ctx.$q.when({ data: response, status: 200 });
          };
          ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
        });
        it('No results returned', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0]).toBe(undefined);
          });
        });
      });
      describe('Missing query', () => {
        const options = {
          targets: [
            {
              queryType: 'Azure Resource Graph',
              hide: false,
            },
          ],
        };
        const response: any = {
          totalRecords: 1,
          count: 1,
          data: {
            columns: [{ name: 'Count', type: 'integer' }],
            rows: [[55542]],
          },
          facets: [],
          resultTruncated: 'false',
        };
        beforeEach(() => {
          ctx.backendSrv.datasourceRequest = () => {
            return ctx.$q.when({ data: response, status: 200 });
          };
          ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
        });
        it('No results returned', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data[0]).toBe(undefined);
          });
        });
      });
    });
    describe('When performing a metricFindQuery', () => {
      describe('ResourceGraph', () => {
        const query = 'ResourceGraph(distinct type)';
        const response = {
          totalRecords: 2,
          count: 2,
          data: {
            columns: [{ name: 'type', type: 'string' }],
            rows: [['microsoft.sql/servers/databases'], ['microsoft.insights/scheduledqueryrules']],
          },
          resultTruncated: 'false',
        };
        beforeEach(() => {
          ctx.backendSrv.datasourceRequest = () => {
            return ctx.$q.when({ data: response, status: 200 });
          };
          ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
        });
        it('Expect valid result', () => {
          return ctx.ds.metricFindQuery(query).then((results: any) => {
            expect(results.length).toBe(2);
            expect(results[0].value).toBe('microsoft.sql/servers/databases');
            expect(results[0].text).toBe('microsoft.sql/servers/databases');
          });
        });
      });
      describe('Invalid Queries', () => {
        const workspaceResponse = {
          value: [
            {
              name: 'aworkspace',
              properties: {
                source: 'Azure',
                customerId: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
              },
            },
          ],
        };
        const resourceGroupResponse = {
          data: {
            value: [{ name: 'grp1' }, { name: 'grp2' }],
          },
          status: 200,
          statusText: 'OK',
        };
        beforeEach(async () => {
          ctx.backendSrv.datasourceRequest = (options: { url: string }) => {
            if (options.url.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
              return ctx.$q.when({ data: workspaceResponse, status: 200 });
            } else if (options.url.indexOf('azuremonitor/subscriptions') > -1) {
              return ctx.$q.when(resourceGroupResponse);
            } else {
              return ctx.$q.when({ data: undefined, status: 200 });
            }
          };
          ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
        });
        it('Should return undefined', () => {
          return ctx.ds.metricFindQuery('ResourceGraphs(distinct type)').then((results: any) => {
            expect(results).toBe(undefined);
          });
        });
        it('Should not clash with other find query', () => {
          return ctx.ds.metricFindQuery('ResourceGroups()').then((results: any) => {
            expect(results).not.toBe(undefined);
          });
        });
      });
    });
  });
  describe('When performing subscriptions query', () => {
    beforeEach(() => {
      ctx.backendSrv.datasourceRequest = () => {
        return ctx.$q.when(RESPONSE_SUBSCRIPTIONS_01);
      };
      ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
    });
    it('getSubscriptionIds', () => {
      return ctx.ds.getSubscriptionIds().then((r: any) => {
        expect(r.length).toBe(RESPONSE_SUBSCRIPTIONS_01.data.value.length);
        expect(r[0]).toBe(`${SUBSCRIPTION_ID_DUMMY_01}`);
      });
    });
  });
});
