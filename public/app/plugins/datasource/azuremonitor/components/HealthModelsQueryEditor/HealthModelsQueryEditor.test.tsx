import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { firstValueFrom, Subject } from 'rxjs';

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

  it('shows loading health models for an automatically selected subscription', async () => {
    const user = userEvent.setup();
    const healthModelsResponse = new Subject<Array<{ text: string; value: string }>>();
    const getSubscriptions = jest.fn().mockResolvedValue([{ text: 'Subscription A', value: 'sub-a' }]);
    const getHealthModels = jest.fn().mockReturnValue(firstValueFrom(healthModelsResponse));
    const datasource = createMockDatasource({ getSubscriptions, getHealthModels });
    const query = createMockQuery({
      queryType: AzureQueryType.AzureHealthModels,
      subscription: undefined,
      azureHealthModels: {},
    });

    render(<HealthModelsQueryEditor query={query} datasource={datasource} onChange={jest.fn()} setError={jest.fn()} />);

    await waitFor(() => expect(getHealthModels).toHaveBeenCalledWith('sub-a'));
    await user.click(screen.getByRole('combobox', { name: 'Azure Monitor Health Model' }));

    expect(await screen.findByText('Loading options...')).toBeInTheDocument();
    expect(screen.queryByText('No health models found')).not.toBeInTheDocument();

    await act(async () => {
      healthModelsResponse.next([
        { text: 'Health Model A', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-a' },
      ]);
    });

    expect(await screen.findByRole('option', { name: /Health Model A/ })).toBeInTheDocument();
    expect(screen.queryByText('Loading options...')).not.toBeInTheDocument();
  });

  it('clears stale health models while loading an externally selected subscription', async () => {
    const user = userEvent.setup();
    const healthModelsResponse = new Subject<Array<{ text: string; value: string }>>();
    const getSubscriptions = jest.fn().mockResolvedValue([
      { text: 'Subscription A', value: 'sub-a' },
      { text: 'Subscription B', value: 'sub-b' },
    ]);
    const getHealthModels = jest
      .fn()
      .mockResolvedValueOnce([
        { text: 'Health Model A', value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-a' },
      ])
      .mockReturnValueOnce(firstValueFrom(healthModelsResponse));
    const datasource = createMockDatasource({ getSubscriptions, getHealthModels });
    const onChange = jest.fn();
    const setError = jest.fn();
    const query = createMockQuery({
      queryType: AzureQueryType.AzureHealthModels,
      subscription: undefined,
      azureHealthModels: {},
    });
    const { rerender } = render(
      <HealthModelsQueryEditor
        query={query}
        datasource={datasource}
        subscriptionId="sub-a"
        onChange={onChange}
        setError={setError}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Azure Monitor Health Model' }));
    expect(await screen.findByRole('option', { name: /Health Model A/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: 'sub-a',
          azureHealthModels: expect.objectContaining({
            healthModelResourceId: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-a',
          }),
        })
      )
    );
    await user.keyboard('{Escape}');
    onChange.mockClear();

    rerender(
      <HealthModelsQueryEditor
        query={query}
        datasource={datasource}
        subscriptionId="sub-b"
        onChange={onChange}
        setError={setError}
      />
    );

    await waitFor(() => expect(getHealthModels).toHaveBeenCalledWith('sub-b'));
    await user.click(screen.getByRole('combobox', { name: 'Azure Monitor Health Model' }));

    expect(await screen.findByText('Loading options...')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Health Model A/ })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      healthModelsResponse.next([
        { text: 'Health Model B', value: '/subscriptions/sub-b/providers/Microsoft.CloudHealth/healthmodels/hm-b' },
      ]);
    });

    expect(await screen.findByRole('option', { name: /Health Model B/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: 'sub-b',
          azureHealthModels: expect.objectContaining({
            healthModelResourceId: '/subscriptions/sub-b/providers/Microsoft.CloudHealth/healthmodels/hm-b',
          }),
        })
      )
    );
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

    render(<HealthModelsQueryEditor query={query} datasource={datasource} onChange={jest.fn()} setError={setError} />);

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
