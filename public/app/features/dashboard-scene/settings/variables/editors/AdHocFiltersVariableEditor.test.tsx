import { render, act, waitFor, within, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { of } from 'rxjs';

import {
  FieldType,
  LoadingState,
  PanelData,
  VariableSupportType,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setRunRequest } from '@grafana/runtime';
import { AdHocFiltersVariable } from '@grafana/scenes';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { AdHocFiltersVariableEditor, getAdHocFilterOptions } from './AdHocFiltersVariableEditor';

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
    }),
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [
      toDataFrame({
        fields: [{ name: 'text', type: FieldType.string, values: ['val1', 'val2', 'val11'] }],
      }),
    ],
    timeRange: getDefaultTimeRange(),
  })
);

setRunRequest(runRequestMock);

describe('AdHocFiltersVariableEditor', () => {
  it('renders AdHocVariableForm with correct props', async () => {
    const { renderer } = await setup();
    const dataSourcePicker = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.datasourceSelect
    );
    const infoText = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.infoText
    );
    const allowCustomValueCheckbox = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker.getAttribute('placeholder')).toBe('Default Test Data Source');
    expect(infoText).toBeInTheDocument();
    expect(infoText).toHaveTextContent('This data source does not support ad hoc filters yet.');
  });

  it('should update the variable data source when data source picker is changed', async () => {
    const { renderer, variable, user } = await setup();

    // Simulate changing the data source
    await user.click(renderer.getByTestId(selectors.components.DataSourcePicker.inputV2));
    await user.click(renderer.getByText(/prom/i));

    expect(variable.state.datasource).toEqual({ uid: 'prometheus', type: 'prometheus' });
  });

  it('should update the variable default keys when the default keys options is enabled', async () => {
    const { renderer, variable, user } = await setup();

    // Simulate toggling default options on
    await user.click(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle)
    );

    expect(variable.state.defaultKeys).toEqual([]);
  });

  it('should update the variable default keys when the default keys option is disabled', async () => {
    const { renderer, variable, user } = await setup(undefined, true);

    // Simulate toggling default options off
    await user.click(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle)
    );

    expect(variable.state.defaultKeys).toEqual(undefined);
  });

  it('should return an OptionsPaneItemDescriptor that renders ModalEditor', async () => {
    const variable = new AdHocFiltersVariable({
      name: 'test',
      datasource: { uid: defaultDatasource.uid, type: defaultDatasource.type },
    });

    const result = getAdHocFilterOptions(variable);

    expect(result.length).toBe(1);
    const descriptor = result[0];

    // Mock the parent property that OptionsPaneItem expects
    descriptor.parent = new OptionsPaneCategoryDescriptor({
      id: 'mock-parent-id',
      title: 'Mock Parent',
    });

    const { queryByRole } = render(descriptor.render());
    const user = userEvent.setup();

    // Initial state: "Open variable editor" button is visible, Modal is not.
    const openEditorButton = screen.getByRole('button', { name: 'Open variable editor' });
    expect(openEditorButton).toBeInTheDocument();
    expect(queryByRole('dialog')).not.toBeInTheDocument(); // Modal has role 'dialog'

    // Opening Modal
    await user.click(openEditorButton);
    const modal = await screen.findByRole('dialog'); // wait for modal to appear
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Ad Hoc Variable')).toBeInTheDocument(); // Modal title

    // Assert Editor's key elements are rendered
    // DataSourcePicker's Field
    expect(within(modal).getByLabelText('Data source')).toBeInTheDocument();

    // Assert Close button is visible
    // To distinguish from the header 'X' (aria-label="Close"), find the span with text "Close" and get its parent button.
    const closeButtonTextSpan = within(modal).getByText(/^Close$/);
    const closeButton = closeButtonTextSpan.closest('button')!;
    expect(closeButton).toBeInTheDocument();

    // Closing Modal
    await user.click(closeButton);
    await waitFor(() => {
      expect(queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

async function setup(props?: React.ComponentProps<typeof AdHocFiltersVariableEditor>, withDefaultKeys = false) {
  const onRunQuery = jest.fn();
  const variable = new AdHocFiltersVariable({
    name: 'adhocVariable',
    type: 'adhoc',
    label: 'Ad hoc filters',
    description: 'Ad hoc filters are applied automatically to all queries that target this data source',
    datasource: { uid: defaultDatasource.uid, type: defaultDatasource.type },
    filters: [
      {
        key: 'test',
        operator: '=',
        value: 'testValue',
      },
    ],
    baseFilters: [
      {
        key: 'baseTest',
        operator: '=',
        value: 'baseTestValue',
      },
    ],
    allowCustomValue: true,
    defaultKeys: withDefaultKeys ? [{ text: 'A', value: 'A' }] : undefined,
  });
  return {
    renderer: await act(() =>
      render(<AdHocFiltersVariableEditor variable={variable} onRunQuery={onRunQuery} {...props} />)
    ),
    variable,
    user: userEvent.setup(),
    mocks: { onRunQuery },
  };
}
