import { get, set } from 'lodash';

import { CustomVariableModel } from '@grafana/data';

import { Context, createContext } from '../mocks/datasource';
import { createMockInstanceSetttings } from '../mocks/instanceSettings';
import createMockQuery from '../mocks/query';
import { createTemplateVariables } from '../mocks/utils';
import { multiVariable, singleVariable, subscriptionsVariable } from '../mocks/variables';
import { AzureQueryType } from '../types/query';

import AzureResourceGraphDatasource from './azure_resource_graph_datasource';

let getTempVars = () => [] as CustomVariableModel[];
let replace = (value?: string) => value || '';

jest.mock('@grafana/runtime', () => {
  return {
    __esModule: true,
    ...jest.requireActual('@grafana/runtime'),
    getTemplateSrv: () => ({
      replace: replace,
      getVariables: getTempVars,
      updateTimeRange: jest.fn(),
      containsTemplate: jest.fn(),
    }),
  };
});

describe('AzureResourceGraphDatasource', () => {
  let ctx: Context;

  describe('When performing interpolateVariablesInQueries for azure_resource_graph', () => {
    beforeEach(() => {
      ctx = createContext({
        instanceSettings: {
          url: 'http://azureresourcegraphapi',
          jsonData: { subscriptionId: '9935389e-9122-4ef9-95f9-1513dd24753f', cloudName: 'azuremonitor' },
        },
      });
      getTempVars = () => [] as CustomVariableModel[];
      replace = (target?: string) => target || '';
    });

    it('should return a query unchanged if no template variables are provided', () => {
      const query = createMockQuery();
      query.queryType = AzureQueryType.AzureResourceGraph;
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery).toEqual([query]);
    });

    it('should return a query with any template variables replaced', () => {
      const templateableProps = ['query'];
      const templateVariables = createTemplateVariables(templateableProps);
      replace = () => 'query-template-variable';
      const query = createMockQuery();
      const azureResourceGraph = {};
      for (const [path, templateVariable] of templateVariables.entries()) {
        set(azureResourceGraph, path, `$${templateVariable.variableName}`);
      }

      query.queryType = AzureQueryType.AzureResourceGraph;
      query.azureResourceGraph = {
        ...query.azureResourceGraph,
        ...azureResourceGraph,
      };
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      for (const [path, templateVariable] of templateVariables.entries()) {
        expect(get(templatedQuery[0].azureResourceGraph, path)).toEqual(
          templateVariable.templateVariable.current.value
        );
      }
    });
  });

  describe('When applying template variables', () => {
    beforeEach(() => {
      getTempVars = () => [] as CustomVariableModel[];
      replace = (target?: string) => target || '';
    });

    it('should expand single value template variable', () => {
      const target = createMockQuery({
        subscriptions: [],
        azureResourceGraph: {
          query: 'Resources | $var1',
          resultFormat: '',
        },
      });
      getTempVars = () =>
        Array.from([subscriptionsVariable, singleVariable, multiVariable].values()).map((item) => item);
      replace = (target?: string | undefined) =>
        target === 'Resources | $var1' ? 'Resources | var1-foo' : target || '';
      expect(ctx.datasource.azureResourceGraphDatasource.applyTemplateVariables(target, {})).toEqual(
        expect.objectContaining({
          ...target,
          azureResourceGraph: { query: 'Resources | var1-foo', resultFormat: 'table' },
          queryType: 'Azure Resource Graph',
          subscriptions: [],
        })
      );
    });

    it('should expand multi value template variable', () => {
      const target = createMockQuery({
        subscriptions: [],
        azureResourceGraph: {
          query: 'resources | where $__contains(name, $var3)',
          resultFormat: '',
        },
      });
      getTempVars = () =>
        Array.from([subscriptionsVariable, singleVariable, multiVariable].values()).map((item) => item);
      replace = (target?: string | undefined) => {
        if (target === 'resources | where $__contains(name, $var3)') {
          return "resources | where $__contains(name, 'var3-foo','var3-baz')";
        }
        return target || '';
      };
      expect(ctx.datasource.azureResourceGraphDatasource.applyTemplateVariables(target, {})).toEqual(
        expect.objectContaining({
          ...target,
          azureResourceGraph: {
            query: `resources | where $__contains(name, 'var3-foo','var3-baz')`,
            resultFormat: 'table',
          },
          queryType: 'Azure Resource Graph',
          subscriptions: [],
        })
      );
    });
  });

  it('should apply subscription variable', () => {
    const target = createMockQuery({
      subscriptions: ['$subs'],
      azureResourceGraph: {
        query: 'resources | where $__contains(name)',
        resultFormat: '',
      },
    });
    getTempVars = () => Array.from([subscriptionsVariable, singleVariable, multiVariable].values()).map((item) => item);
    replace = (target?: string | undefined) => (target === '$subs' ? 'sub-foo,sub-baz' : target || '');
    expect(ctx.datasource.azureResourceGraphDatasource.applyTemplateVariables(target, {})).toEqual(
      expect.objectContaining({
        azureResourceGraph: {
          query: `resources | where $__contains(name)`,
          resultFormat: 'table',
        },
        queryType: 'Azure Resource Graph',
        subscriptions: ['sub-foo', 'sub-baz'],
      })
    );
  });

  describe('pagedResourceGraphRequest', () => {
    it('makes multiple requests when it is returned a skip token', async () => {
      const instanceSettings = createMockInstanceSetttings();
      const datasource = new AzureResourceGraphDatasource(instanceSettings);
      const postResource = jest.fn();
      datasource.postResource = postResource;
      const mockResponses = [
        { data: ['some resource data'], $skipToken: 'skipToken' },
        { data: ['some more resource data'] },
      ];
      for (const response of mockResponses) {
        postResource.mockResolvedValueOnce(response);
      }

      await datasource.pagedResourceGraphRequest('some query');

      expect(postResource).toHaveBeenCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.options.$skipToken).toEqual('skipToken');
    });
  });

  describe('getSubscriptions', () => {
    let datasource: AzureResourceGraphDatasource;
    let pagedResourceGraphRequest: jest.SpyInstance;

    beforeEach(() => {
      const instanceSettings = createMockInstanceSetttings();
      datasource = new AzureResourceGraphDatasource(instanceSettings);
      pagedResourceGraphRequest = jest.spyOn(datasource, 'pagedResourceGraphRequest');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return subscriptions without filters', async () => {
      const mockSubscriptions = [
        {
          subscriptionId: '1',
          subscriptionName: 'Primary Subscription',
          subscriptionURI: '/subscriptions/1',
          count: 5,
        },
        {
          subscriptionId: '2',
          subscriptionName: 'Dev Subscription',
          subscriptionURI: '/subscriptions/2',
          count: 3,
        },
      ];

      pagedResourceGraphRequest.mockResolvedValue(mockSubscriptions);

      const result = await datasource.getSubscriptions();

      expect(result).toEqual(mockSubscriptions);
      expect(pagedResourceGraphRequest).toHaveBeenCalledWith(expect.stringContaining('resources'), 1);
      expect(pagedResourceGraphRequest).toHaveBeenCalledWith(
        expect.not.stringContaining('| where subscriptionId in'),
        1
      );
      expect(pagedResourceGraphRequest).toHaveBeenCalledWith(expect.not.stringContaining('| where type in'), 1);
      expect(pagedResourceGraphRequest).toHaveBeenCalledWith(expect.not.stringContaining('| where location in'), 1);
    });

    it('should generate correct query structure', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);

      await datasource.getSubscriptions();

      const query = pagedResourceGraphRequest.mock.calls[0][0];

      expect(query).toContain('resources');
      expect(query).toContain('join kind=inner');
      expect(query).toContain('ResourceContainers');
      expect(query).toContain("type == 'microsoft.resources/subscriptions'");
      expect(query).toContain('project subscriptionName=name, subscriptionURI=id, subscriptionId');
      expect(query).toContain('summarize count=count() by subscriptionName, subscriptionURI, subscriptionId');
      expect(query).toContain('order by subscriptionName desc');
    });

    it('should apply filters when provided', async () => {
      const filters = {
        subscriptions: ['sub1', 'sub2'],
        types: ['microsoft.compute/virtualmachines', 'microsoft.storage/storageaccounts'],
        locations: ['eastus', 'westus'],
      };

      pagedResourceGraphRequest.mockResolvedValue([]);

      await datasource.getSubscriptions(filters);

      const query = pagedResourceGraphRequest.mock.calls[0][0];

      expect(query).toContain('| where subscriptionId in ("sub1","sub2")');
      expect(query).toContain(
        '| where type in ("microsoft.compute/virtualmachines","microsoft.storage/storageaccounts")'
      );
      expect(query).toContain('| where location in ("eastus","westus")');
    });

    it('should apply partial filters', async () => {
      const filters = {
        subscriptions: ['sub1'],
        types: [],
        locations: ['eastus'],
      };

      pagedResourceGraphRequest.mockResolvedValue([]);

      await datasource.getSubscriptions(filters);

      const query = pagedResourceGraphRequest.mock.calls[0][0];

      expect(query).toContain('| where subscriptionId in ("sub1")');
      expect(query).not.toContain('| where type in');
      expect(query).toContain('| where location in ("eastus")');
    });

    it('should handle empty filters gracefully', async () => {
      const filters = {
        subscriptions: [],
        types: [],
        locations: [],
      };

      pagedResourceGraphRequest.mockResolvedValue([]);

      await datasource.getSubscriptions(filters);

      const query = pagedResourceGraphRequest.mock.calls[0][0];

      expect(query).not.toContain('| where subscriptionId in');
      expect(query).not.toContain('| where type in');
      expect(query).not.toContain('| where location in');
    });

    it('should return empty array when no subscriptions found', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);

      const result = await datasource.getSubscriptions();

      expect(result).toEqual([]);
    });

    it('should lowercase filter values', async () => {
      const filters = {
        subscriptions: ['SUB1', 'Sub2'],
        types: ['Microsoft.Compute/VirtualMachines'],
        locations: ['EastUS'],
      };

      pagedResourceGraphRequest.mockResolvedValue([]);

      await datasource.getSubscriptions(filters);

      const query = pagedResourceGraphRequest.mock.calls[0][0];

      expect(query).toContain('"sub1","sub2"');
      expect(query).toContain('"microsoft.compute/virtualmachines"');
      expect(query).toContain('"eastus"');
    });
  });

  describe('getResourceGroups', () => {
    let datasource: AzureResourceGraphDatasource;
    let pagedResourceGraphRequest: jest.SpyInstance;

    beforeEach(() => {
      const instanceSettings = createMockInstanceSetttings();
      datasource = new AzureResourceGraphDatasource(instanceSettings);
      pagedResourceGraphRequest = jest.spyOn(datasource, 'pagedResourceGraphRequest');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return resource groups without filters', async () => {
      const mockResourceGroups = [
        {
          resourceGroup: 'rg1',
          resourceGroupName: 'Resource Group 1',
          resourceGroupURI: '/subscriptions/1/resourceGroups/rg1',
          count: 2,
        },
        {
          resourceGroup: 'rg2',
          resourceGroupName: 'Resource Group 2',
          resourceGroupURI: '/subscriptions/1/resourceGroups/rg2',
          count: 1,
        },
      ];
      pagedResourceGraphRequest.mockResolvedValue(mockResourceGroups);
      const result = await datasource.getResourceGroups('1');
      expect(result).toEqual(mockResourceGroups);
      expect(pagedResourceGraphRequest).toHaveBeenCalledWith(expect.not.stringContaining('| where type in'));
      expect(pagedResourceGraphRequest).toHaveBeenCalledWith(expect.not.stringContaining('| where location in'));
    });

    it('should generate correct query structure', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);
      await datasource.getResourceGroups('1');
      const query = pagedResourceGraphRequest.mock.calls[0][0];
      expect(query).toContain('resources');
      expect(query).toContain("| where subscriptionId == '1'");
      expect(query).toContain(
        '| extend resourceGroupURI = strcat(\"/subscriptions/\", subscriptionId, \"/resourcegroups/\", resourceGroup)'
      );
      expect(query).toContain('join kind=leftouter');
      expect(query).toContain('resourcecontainers');
      expect(query).toContain("| where type =~ 'microsoft.resources/subscriptions/resourcegroups'");
      expect(query).toContain(
        '| project resourceGroupName=iff(resourceGroupName != \"\", resourceGroupName, resourceGroup), resourceGroupURI'
      );
      expect(query).toContain('summarize count=count() by resourceGroupName, resourceGroupURI');
      expect(query).toContain('| order by tolower(resourceGroupName) asc');
    });

    it('should apply filters when provided', async () => {
      const filters = {
        subscriptions: [],
        types: ['microsoft.compute/virtualmachines', 'microsoft.storage/storageaccounts'],
        locations: ['eastus', 'westus'],
      };
      pagedResourceGraphRequest.mockResolvedValue([]);
      await datasource.getResourceGroups('1', undefined, filters);
      const query = pagedResourceGraphRequest.mock.calls[0][0];
      expect(query).toContain(
        '| where type in ("microsoft.compute/virtualmachines","microsoft.storage/storageaccounts")'
      );
      expect(query).toContain('| where location in ("eastus","westus")');
    });

    it('should apply partial filters', async () => {
      const filters = {
        subscriptions: [],
        types: [],
        locations: ['eastus'],
      };
      pagedResourceGraphRequest.mockResolvedValue([]);
      await datasource.getResourceGroups('1', undefined, filters);
      const query = pagedResourceGraphRequest.mock.calls[0][0];
      expect(query).not.toContain('| where type in');
      expect(query).toContain('| where location in ("eastus")');
    });

    it('should handle empty filters gracefully', async () => {
      const filters = {
        subscriptions: [],
        types: [],
        locations: [],
      };
      pagedResourceGraphRequest.mockResolvedValue([]);
      await datasource.getResourceGroups('1', undefined, filters);
      const query = pagedResourceGraphRequest.mock.calls[0][0];
      expect(query).not.toContain('| where type in');
      expect(query).not.toContain('| where location in');
    });

    it('should return empty array when no resource groups found', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);
      const result = await datasource.getResourceGroups('1');
      expect(result).toEqual([]);
    });

    it('should lowercase filter values', async () => {
      const filters = {
        subscriptions: [],
        types: ['Microsoft.Compute/VirtualMachines'],
        locations: ['EastUS'],
      };
      pagedResourceGraphRequest.mockResolvedValue([]);
      await datasource.getResourceGroups('1', undefined, filters);
      const query = pagedResourceGraphRequest.mock.calls[0][0];
      expect(query).toContain('"microsoft.compute/virtualmachines"');
      expect(query).toContain('"eastus"');
    });

    it('will ignore subscription filters', async () => {
      const filters = {
        subscriptions: ['1234'],
        types: [],
        locations: [],
      };
      pagedResourceGraphRequest.mockResolvedValue([]);
      await datasource.getResourceGroups('1', undefined, filters);
      const query = pagedResourceGraphRequest.mock.calls[0][0];
      expect(query).not.toContain('| where subscriptionId in (1234)');
      expect(query).toContain("| where subscriptionId == '1'");
    });
  });

  describe('getResourceNames', () => {
    let datasource: AzureResourceGraphDatasource;
    let pagedResourceGraphRequest: jest.SpyInstance;

    beforeEach(() => {
      const instanceSettings = createMockInstanceSetttings();
      datasource = new AzureResourceGraphDatasource(instanceSettings);
      pagedResourceGraphRequest = jest.spyOn(datasource, 'pagedResourceGraphRequest');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return resource names without filters', async () => {
      const mockResources = [
        {
          id: '/subscriptions/1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1',
          name: 'vm1',
          type: 'microsoft.compute/virtualmachines',
          location: 'eastus',
        },
        {
          id: '/subscriptions/1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm2',
          name: 'vm2',
          type: 'microsoft.compute/virtualmachines',
          location: 'westus',
        },
      ];
      pagedResourceGraphRequest.mockResolvedValue(mockResources);
      const query = {
        subscriptionId: '1',
        resourceGroup: 'rg1',
      };
      const result = await datasource.getResourceNames(query);
      expect(result).toEqual(mockResources);
      expect(pagedResourceGraphRequest).toHaveBeenCalledWith(expect.stringContaining('resources'));
    });

    it('should generate correct query structure', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);
      const query = {
        subscriptionId: '1',
        resourceGroup: 'rg1',
      };

      await datasource.getResourceNames(query);
      const builtQuery = pagedResourceGraphRequest.mock.calls[0][0];
      expect(builtQuery).toContain('resources');
      expect(builtQuery).toContain('| where id hasprefix "/subscriptions/1/resourceGroups/rg1/"');
      expect(builtQuery).toContain('| order by tolower(name) asc');
    });

    it('should apply metric namespace and region filters based on query parameters', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);
      const query = {
        subscriptionId: '1',
        resourceGroup: 'rg1',
        metricNamespace: 'Microsoft.Compute/virtualMachines',
        region: 'eastus',
      };
      await datasource.getResourceNames(query);
      const builtQuery = pagedResourceGraphRequest.mock.calls[0][0];
      expect(builtQuery).toContain("type == 'microsoft.compute/virtualmachines'");
      expect(builtQuery).toContain("location == 'eastus'");
    });

    it('should apply resourceFilters if provided', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);
      const query = {
        subscriptionId: '1',
        resourceGroup: 'rg1',
      };
      const resourceFilters = {
        subscriptions: [],
        types: ['microsoft.storage/storageaccounts'],
        locations: ['westeurope'],
      };
      await datasource.getResourceNames(query, undefined, resourceFilters);
      const builtQuery = pagedResourceGraphRequest.mock.calls[0][0];
      expect(builtQuery).toContain('| where type in ("microsoft.storage/storageaccounts")');
      expect(builtQuery).toContain('| where location in ("westeurope")');
    });

    it('should handle empty resourceFilters gracefully', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);
      const query = {
        subscriptionId: '1',
        resourceGroup: 'rg1',
      };
      const resourceFilters = { subscriptions: [], types: [], locations: [] };
      await datasource.getResourceNames(query, undefined, resourceFilters);
      const builtQuery = pagedResourceGraphRequest.mock.calls[0][0];
      expect(builtQuery).not.toContain('| where type in');
      expect(builtQuery).not.toContain('| where location in');
    });

    it('should return empty array when no resources found', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);
      const query = {
        subscriptionId: '1',
        resourceGroup: 'rg1',
      };
      const result = await datasource.getResourceNames(query);
      expect(result).toEqual([]);
    });

    it('should lowercase metricNamespace', async () => {
      pagedResourceGraphRequest.mockResolvedValue([]);
      const query = {
        subscriptionId: '1',
        resourceGroup: 'rg1',
        metricNamespace: 'Microsoft.Compute/VirtualMachines',
        region: 'EastUS',
      };
      await datasource.getResourceNames(query);
      const builtQuery = pagedResourceGraphRequest.mock.calls[0][0];
      expect(builtQuery).toContain("type == 'microsoft.compute/virtualmachines'");
    });
  });
});
