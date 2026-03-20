import { render, act, waitFor, screen } from '@testing-library/react';
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
import { config, setRunRequest } from '@grafana/runtime';
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

let getTagKeysMock: Function | undefined = () => [];
let getGroupByKeysMock: Function | undefined;

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
      getTagKeys: getTagKeysMock,
      getGroupByKeys: getGroupByKeysMock,
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
  beforeEach(() => {
    getTagKeysMock = () => [];
    getGroupByKeysMock = undefined;
  });

  it('renders AdHocVariableForm with correct props', async () => {
    getTagKeysMock = undefined;

    const { renderer } = await setup();
    const dataSourcePicker = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.datasourceSelect
    );
    const infoText = renderer.queryByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.infoText
    );
    const allowCustomValueCheckbox = renderer.queryByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    expect(allowCustomValueCheckbox).not.toBeInTheDocument();
    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker.getAttribute('placeholder')).toBe('Default Test Data Source');
    expect(infoText).toBeInTheDocument();
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
    getTagKeysMock = () => Promise.resolve(['key1', 'key2']);
    const { renderer, variable, user } = await setup(undefined, true);

    // Simulate toggling default options off
    await user.click(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle)
    );

    expect(variable.state.defaultKeys).toEqual(undefined);
  });

  describe('supportsGroupByOperator', () => {
    afterEach(() => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
    });

    it('should set supportsGroupByOperator to true when feature flag is on and datasource supports getGroupByKeys', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { variable } = await setup();

      await waitFor(() => {
        expect(variable.state.supportsGroupByOperator).toBe(true);
      });
    });

    it('should set supportsGroupByOperator to false when feature flag is on and datasource does not support getGroupByKeys', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = undefined;

      const { variable } = await setup();

      await waitFor(() => {
        expect(variable.state.supportsGroupByOperator).toBe(false);
      });
    });

    it('should not update supportsGroupByOperator when feature flag is off', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { variable } = await setup();

      await waitFor(() => {
        expect(variable.state.supportsGroupByOperator).toBeUndefined();
      });
    });

    it('should show Enable group by toggle when datasource supports getGroupByKeys and feature flag is on', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { renderer } = await setup();

      await waitFor(() => {
        expect(renderer.getByText('Enable group by')).toBeInTheDocument();
      });
    });

    it('should not show Enable group by toggle when datasource does not support getGroupByKeys', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = undefined;

      const { renderer } = await setup();

      await waitFor(() => {
        expect(renderer.queryByText('Enable group by')).not.toBeInTheDocument();
      });
    });

    it('should not show Enable group by toggle when feature flag is off', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { renderer } = await setup();

      await waitFor(() => {
        expect(renderer.queryByText('Enable group by')).not.toBeInTheDocument();
      });
    });

    it('should toggle supportsGroupByOperator when Enable group by switch is clicked', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { renderer, variable, user } = await setup();

      await waitFor(() => {
        expect(renderer.getByText('Enable group by')).toBeInTheDocument();
      });

      const toggle = renderer.getByText('Enable group by').closest('div')?.querySelector('input[type="checkbox"]');
      expect(toggle).toBeInTheDocument();

      await user.click(toggle!);

      expect(variable.state.supportsGroupByOperator).toBe(false);
    });
  });

  it('should return an OptionsPaneItemDescriptor that renders Editor', async () => {
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

    render(descriptor.renderElement());

    await waitFor(() => {
      // Check that some part of the component renders
      expect(screen.getByText(/data source does not support/i)).toBeInTheDocument();
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
