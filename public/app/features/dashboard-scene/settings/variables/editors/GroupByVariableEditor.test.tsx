import { act, render, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MetricFindValue, VariableSupportType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { GroupByVariable } from '@grafana/scenes';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { getGroupByVariableOptions, GroupByVariableEditor } from './GroupByVariableEditor';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  uid: 'test-ds',
  type: 'test',
});

const promDatasource = mockDataSource({
  name: 'Prometheus',
  uid: 'prometheus',
  type: 'prometheus',
});

const mockGetGroupByKeys = jest.fn().mockReturnValue([
  { text: 'job', value: 'job' },
  { text: 'instance', value: 'instance' },
]);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => ({
      ...defaultDatasource,
      variables: {
        getType: () => VariableSupportType.Custom,
        query: jest.fn(),
        editor: jest.fn().mockImplementation(LegacyVariableQueryEditor),
      },
      getGroupByKeys: mockGetGroupByKeys,
    }),
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

describe('GroupByVariableEditor', () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 1000,
        height: 1000,
        x: 0,
        y: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      })),
    });
  });

  it('renders GroupByVariableForm with correct props', async () => {
    const { renderer } = await setup();
    const dataSourcePicker = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect
    );

    const allowCustomValueCheckbox = renderer.queryByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker.getAttribute('placeholder')).toBe('Default Test Data Source');
  });

  it('should update the variable data source when data source picker is changed', async () => {
    const { renderer, variable, user } = await setup();

    // Simulate changing the data source
    await user.click(renderer.getByTestId(selectors.components.DataSourcePicker.inputV2));
    await user.click(renderer.getByText(/prom/i));

    expect(variable.state.datasource).toEqual({ uid: 'prometheus', type: 'prometheus' });
  });

  it('should update the variable default options when static options are enabled', async () => {
    const { renderer, variable, user } = await setup();

    // Simulate toggling static options on
    await user.click(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.modeToggle)
    );

    expect(variable.state.defaultOptions).toEqual([]);
  });

  it('should update the variable default options when static options are disabled', async () => {
    const { renderer, variable, user } = await setup([{ text: 'A', value: 'A' }]);

    // Simulate toggling static options off
    await user.click(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.modeToggle)
    );

    expect(variable.state.defaultOptions).toEqual(undefined);
  });

  it('should fetch group by keys from datasource', async () => {
    await setup();

    await waitFor(() => {
      expect(mockGetGroupByKeys).toHaveBeenCalledWith({ filters: [] });
    });
  });

  it('should render provided default values as pills', async () => {
    const { renderer } = await setup(undefined, { value: ['job'], text: ['job'] });

    const section = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.defaultValueSection
    );
    expect(within(section).getByText('job')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('should update variable defaultValue when selecting a value from dropdown', async () => {
    const { renderer, variable, user } = await setup();

    await waitFor(() => {
      expect(
        renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.defaultValueSection)
      ).toBeInTheDocument();
    });

    const combobox = within(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.defaultValueSection)
    ).getByRole('combobox');
    await user.click(combobox);
    await user.click(await screen.findByRole('option', { name: 'job' }));

    expect(variable.state.defaultValue).toEqual({ value: ['job'], text: ['job'] });
  });

  it('should return an OptionsPaneItemDescriptor that renders Editor', async () => {
    const variable = new GroupByVariable({
      name: 'test',
      datasource: { uid: defaultDatasource.uid, type: defaultDatasource.type },
    });

    const result = getGroupByVariableOptions(variable);

    expect(result.length).toBe(1);
    const descriptor = result[0];

    // Mock the parent property that OptionsPaneItem expects
    descriptor.parent = new OptionsPaneCategoryDescriptor({
      id: 'mock-parent-id',
      title: 'Mock Parent',
    });

    render(descriptor.renderElement());

    await waitFor(() => {
      expect(
        screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect)
      ).toBeInTheDocument();
    });
  });
});

async function setup(defaultOptions?: MetricFindValue[], defaultValue?: { value: string[]; text: string[] }) {
  const onRunQuery = jest.fn();
  const variable = new GroupByVariable({
    name: 'groupByVariable',
    type: 'groupby',
    label: 'Group By',
    datasource: { uid: defaultDatasource.uid, type: defaultDatasource.type },
    defaultOptions,
    defaultValue,
  });
  const renderer = render(<GroupByVariableEditor variable={variable} onRunQuery={onRunQuery} />);

  // Flush first useAsync (datasource)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  // Flush second useAsync (groupByKeys, depends on datasource)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return {
    renderer,
    variable,
    user: userEvent.setup(),
    mocks: { onRunQuery },
  };
}
