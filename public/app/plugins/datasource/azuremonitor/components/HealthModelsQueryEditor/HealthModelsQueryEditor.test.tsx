import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockComboboxRect } from '@grafana/test-utils';

import createMockDatasource from '../../mocks/datasource';
import { createMockHealthModelsQuery } from '../../mocks/query';

import HealthModelsQueryEditor from './HealthModelsQueryEditor';

const subscriptionId = '11111111-1111-1111-1111-111111111111';
const otherSubscriptionId = '22222222-2222-2222-2222-222222222222';
const healthModelId = `/subscriptions/${subscriptionId}/resourceGroups/rg-one/providers/Microsoft.CloudHealth/healthmodels/model-one`;

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('HealthModelsQueryEditor', () => {
  beforeAll(() => {
    mockComboboxRect();
  });

  it('loads Health Models for the selected subscription and stores the selected model ID', async () => {
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([{ text: 'Subscription One', value: subscriptionId }]),
      azureHealthModelsDatasource: {
        getHealthModels: jest.fn().mockResolvedValue([
          {
            id: healthModelId,
            name: 'model-one',
            type: 'Microsoft.CloudHealth/healthmodels',
          },
        ]),
      },
    });
    const onChange = jest.fn();
    const query = createMockHealthModelsQuery({
      subscription: subscriptionId,
      azureHealthModels: { healthModelId: undefined },
    });

    render(
      <HealthModelsQueryEditor
        query={query}
        datasource={datasource}
        onChange={onChange}
        variableOptionGroup={variableOptionGroup}
        setError={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(datasource.azureHealthModelsDatasource.getHealthModels).toHaveBeenCalledWith(subscriptionId)
    );

    const healthModelSelect = await screen.findByLabelText('Azure Health Model');
    await userEvent.click(healthModelSelect);
    await userEvent.click(await screen.findByRole('option', { name: /model-one \(rg-one\)/ }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: subscriptionId,
        azureHealthModels: {
          healthModelId,
        },
      })
    );
  });

  it('clears the Health Model when the subscription changes', async () => {
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([
        { text: 'Subscription One', value: subscriptionId },
        { text: 'Subscription Two', value: otherSubscriptionId },
      ]),
      azureHealthModelsDatasource: {
        getHealthModels: jest.fn().mockResolvedValue([]),
      },
    });
    const onChange = jest.fn();
    const query = createMockHealthModelsQuery({
      subscription: subscriptionId,
      azureHealthModels: { healthModelId },
    });

    render(
      <HealthModelsQueryEditor
        query={query}
        datasource={datasource}
        onChange={onChange}
        variableOptionGroup={variableOptionGroup}
        setError={jest.fn()}
      />
    );

    const subscriptionSelect = await screen.findByLabelText('Health Models subscription');
    await userEvent.click(subscriptionSelect);
    await userEvent.click(await screen.findByRole('option', { name: /Subscription Two/ }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: otherSubscriptionId,
        azureHealthModels: {
          healthModelId: undefined,
        },
      })
    );
  });
});
