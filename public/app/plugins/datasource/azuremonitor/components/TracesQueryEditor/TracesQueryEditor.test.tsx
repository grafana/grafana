import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { createMockResourcePickerData } from '../MetricsQueryEditor/MetricsQueryEditor.test';

import TracesQueryEditor from './TracesQueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('TracesQueryEditor', () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });
  afterEach(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('should select multiple resources', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureTraces?.resources;
    const onChange = jest.fn();

    render(
      <TracesQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('app-insights-1');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const checkbox2 = await screen.findByLabelText('app-insights-2');
    await userEvent.click(checkbox2);
    expect(checkbox2).toBeChecked();

    await userEvent.click(await screen.findByRole('button', { name: 'Apply' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureTraces: expect.objectContaining({
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.insights/components/app-insights-1',
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.insights/components/app-insights-2',
          ],
        }),
      })
    );
  });

  it('should disable other resource types when selecting multiple resources', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureTraces?.resources;
    const onChange = jest.fn();

    render(
      <TracesQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('app-insights-1');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    expect(await screen.findByLabelText('web-server_DataDisk')).toBeDisabled();
  });

  it('should show info about multiple selection', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureTraces?.resources;
    const onChange = jest.fn();

    render(
      <TracesQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('app-insights-1');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    expect(await screen.findByText('You may only choose items of the same resource type.')).toBeInTheDocument();
  });

  it('should call onApply with a new subscription uri when a user types it in the selection box', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureTraces?.resources;
    const onChange = jest.fn();

    render(
      <TracesQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    await userEvent.click(resourcePickerButton);

    const advancedSection = screen.getByText('Advanced');
    await userEvent.click(advancedSection);

    const advancedInput = await screen.findByTestId('input-advanced-resource-picker-1');

    await userEvent.type(advancedInput, '/subscriptions/def-123');

    const applyButton = screen.getByRole('button', { name: 'Apply' });
    await userEvent.click(applyButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureTraces: expect.objectContaining({
          resources: ['/subscriptions/def-123'],
        }),
      })
    );
  });
});
