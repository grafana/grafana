import { render, screen, waitFor } from '@testing-library/react';

import { mockComboboxRect } from '@grafana/test-utils';

import { AzureHealthModelsQueryType, AzureQueryType } from '../../dataquery.gen';
import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';
import { selectOptionInTest } from '../../utils/testUtils';

import HealthModelsQueryEditor from './HealthModelsQueryEditor';

describe('HealthModelsQueryEditor', () => {
  beforeAll(() => {
    mockComboboxRect();
  });

  it('auto-selects the first health model after loading when the query has no selected model', async () => {
    const getSubscriptions = jest.fn().mockResolvedValue([{ text: 'Subscription A', value: 'sub-a' }]);
    const getHealthModels = jest.fn().mockResolvedValue([
      { text: 'Health Model 1', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1' },
      { text: 'Health Model 2', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2' },
    ]);
    const datasource = createMockDatasource({ getSubscriptions, getHealthModels });
    const onChange = jest.fn();
    const setError = jest.fn();
    const query = createMockQuery({
      queryType: AzureQueryType.AzureHealthModels,
      subscription: 'sub-a',
    });
    query.azureHealthModels = {};

    render(<HealthModelsQueryEditor query={query} datasource={datasource} onChange={onChange} setError={setError} />);

    await waitFor(() => expect(getSubscriptions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getHealthModels).toHaveBeenCalledWith('sub-a'));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: 'sub-a',
          azureHealthModels: expect.objectContaining({
            healthModelResourceId: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1',
            queryType: AzureHealthModelsQueryType.EntityHealthSnapshot,
          }),
        })
      )
    );
  });

  it('defaults query type to snapshot when a health model is already selected and no type exists', async () => {
    const getSubscriptions = jest.fn().mockResolvedValue([{ text: 'Subscription A', value: 'sub-a' }]);
    const getHealthModels = jest.fn().mockResolvedValue([
      { text: 'Health Model 1', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1' },
      { text: 'Health Model 2', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2' },
    ]);
    const datasource = createMockDatasource({ getSubscriptions, getHealthModels });
    const onChange = jest.fn();
    const setError = jest.fn();
    const query = createMockQuery({
      queryType: AzureQueryType.AzureHealthModels,
      subscription: 'sub-a',
    });
    query.azureHealthModels = {
      healthModelResourceId: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2',
    };

    render(<HealthModelsQueryEditor query={query} datasource={datasource} onChange={onChange} setError={setError} />);

    await waitFor(() => expect(getHealthModels).toHaveBeenCalledWith('sub-a'));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.AzureHealthModels,
          azureHealthModels: expect.objectContaining({
            healthModelResourceId: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2',
            queryType: AzureHealthModelsQueryType.EntityHealthSnapshot,
          }),
        })
      )
    );
  });

  it('does not overwrite an already-selected health model when it is still present in the fetched list', async () => {
    const getSubscriptions = jest.fn().mockResolvedValue([{ text: 'Subscription A', value: 'sub-a' }]);
    const getHealthModels = jest.fn().mockResolvedValue([
      { text: 'Health Model 1', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1' },
      { text: 'Health Model 2', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2' },
    ]);
    const datasource = createMockDatasource({ getSubscriptions, getHealthModels });
    const onChange = jest.fn();
    const setError = jest.fn();
    const query = createMockQuery({
      queryType: AzureQueryType.AzureHealthModels,
      subscription: 'sub-a',
    });
    query.azureHealthModels = {
      healthModelResourceId: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2',
      queryType: AzureHealthModelsQueryType.EntityHealthHistory,
    };

    render(<HealthModelsQueryEditor query={query} datasource={datasource} onChange={onChange} setError={setError} />);

    await waitFor(() => expect(getHealthModels).toHaveBeenCalledWith('sub-a'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('surfaces health model fetch errors through setError', async () => {
    const getSubscriptions = jest.fn().mockResolvedValue([{ text: 'Subscription A', value: 'sub-a' }]);
    const healthModelError = new Error('Failed to fetch health models');
    const getHealthModels = jest.fn().mockRejectedValue(healthModelError);
    const datasource = createMockDatasource({ getSubscriptions, getHealthModels });
    const setError = jest.fn();
    const query = createMockQuery({
      queryType: AzureQueryType.AzureHealthModels,
      subscription: 'sub-a',
    });
    query.azureHealthModels = {};

    render(
      <HealthModelsQueryEditor query={query} datasource={datasource} onChange={jest.fn()} setError={setError} />
    );

    await waitFor(() => expect(getHealthModels).toHaveBeenCalledWith('sub-a'));
    await waitFor(() => expect(setError).toHaveBeenCalledWith('health-models-list', healthModelError));
  });

  it('updates query type when selecting a health model type', async () => {
    const getSubscriptions = jest.fn().mockResolvedValue([{ text: 'Subscription A', value: 'sub-a' }]);
    const getHealthModels = jest.fn().mockResolvedValue([
      { text: 'Health Model 1', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1' },
      { text: 'Health Model 2', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2' },
    ]);
    const datasource = createMockDatasource({ getSubscriptions, getHealthModels });
    const onChange = jest.fn();
    const query = createMockQuery({
      queryType: AzureQueryType.AzureHealthModels,
      subscription: 'sub-a',
    });
    query.azureHealthModels = {
      healthModelResourceId: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1',
    };

    render(<HealthModelsQueryEditor query={query} datasource={datasource} onChange={onChange} setError={jest.fn()} />);

    await waitFor(() => expect(getHealthModels).toHaveBeenCalledWith('sub-a'));
    const queryTypeSelect = await screen.findByRole('combobox', { name: /Health Models query type/i });
    await selectOptionInTest(queryTypeSelect, 'Entity Health History');

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.AzureHealthModels,
          azureHealthModels: expect.objectContaining({
            healthModelResourceId: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1',
            queryType: AzureHealthModelsQueryType.EntityHealthHistory,
          }),
        })
      )
    );
  });
});
