import { render, act, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { of } from 'rxjs';

import {
  FieldType,
  LoadingState,
  type PanelData,
  type SelectableValue,
  VariableSupportType,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, setRunRequest } from '@grafana/runtime';
import { AdHocFiltersVariable } from '@grafana/scenes';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { type AdHocOriginFiltersController } from '../components/AdHocOriginFiltersController';

import { AdHocFiltersVariableEditor, getAdHocFilterOptions } from './AdHocFiltersVariableEditor';

let capturedOriginController: AdHocOriginFiltersController | undefined;
let capturedDefaultGroupByProps:
  | { values: Array<SelectableValue<string>>; options?: Array<SelectableValue<string>>; onChange: Function }
  | undefined;

jest.mock('../components/AdHocOriginFiltersEditor', () => ({
  AdHocOriginFiltersEditor: ({ controller }: { controller: AdHocOriginFiltersController }) => {
    capturedOriginController = controller;
    return <div data-testid="origin-filters-editor">mock origin editor</div>;
  },
}));

jest.mock('../components/DefaultGroupByValueEditor', () => ({
  DefaultGroupByValueEditor: (props: {
    values: Array<SelectableValue<string>>;
    options?: Array<SelectableValue<string>>;
    onChange: Function;
  }) => {
    capturedDefaultGroupByProps = props;
    return <div data-testid="default-groupby-editor">mock groupby editor</div>;
  },
}));

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
  beforeAll(() => {
    mockBoundingClientRect();
  });

  beforeEach(() => {
    getTagKeysMock = () => [];
    getGroupByKeysMock = undefined;
    capturedOriginController = undefined;
    capturedDefaultGroupByProps = undefined;
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
    const { renderer, variable, user } = await setup(undefined, { withDefaultKeys: true });

    // Simulate toggling default options off
    await user.click(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle)
    );

    expect(variable.state.defaultKeys).toEqual(undefined);
  });

  describe('enableGroupBy', () => {
    afterEach(() => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
    });

    it('should preserve enableGroupBy from deserialization', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { variable } = await setup(undefined, { enableGroupBy: true });

      expect(variable.state.enableGroupBy).toBe(true);
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

    it('should toggle enableGroupBy when Enable group by switch is clicked', async () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { renderer, variable, user } = await setup(undefined, { enableGroupBy: true });

      await waitFor(() => {
        expect(renderer.getByText('Enable group by')).toBeInTheDocument();
      });

      const toggle = renderer.getByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.enableGroupByToggle
      );
      await user.click(toggle);

      expect(variable.state.enableGroupBy).toBe(false);
    });
  });

  describe('default group-by origin', () => {
    afterEach(() => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
      config.featureToggles.adHocFilterDefaultValues = false;
    });

    it('should show default group by editor when both flags are on and enableGroupBy is true', async () => {
      config.featureToggles.adHocFilterDefaultValues = true;
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { renderer } = await setup(undefined, { enableGroupBy: true });

      await waitFor(() => {
        expect(renderer.getByTestId('default-groupby-editor')).toBeInTheDocument();
      });
      expect(capturedDefaultGroupByProps).toBeDefined();
    });

    it('should not show default group by editor when enableGroupBy is off', async () => {
      config.featureToggles.adHocFilterDefaultValues = true;
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { renderer } = await setup();

      await waitFor(() => {
        expect(renderer.getByTestId('origin-filters-editor')).toBeInTheDocument();
      });
      expect(renderer.queryByTestId('default-groupby-editor')).not.toBeInTheDocument();
    });

    it('should not show default group by editor when dashboardUnifiedDrilldownControls is off', async () => {
      config.featureToggles.adHocFilterDefaultValues = true;
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { renderer } = await setup(undefined, { enableGroupBy: true });

      await waitFor(() => {
        expect(renderer.getByTestId('origin-filters-editor')).toBeInTheDocument();
      });
      expect(renderer.queryByTestId('default-groupby-editor')).not.toBeInTheDocument();
    });

    it('should update originFilters when group-by selection changes', async () => {
      config.featureToggles.adHocFilterDefaultValues = true;
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { variable } = await setup(undefined, { enableGroupBy: true });

      await waitFor(() => {
        expect(capturedDefaultGroupByProps).toBeDefined();
      });

      act(() => {
        capturedDefaultGroupByProps!.onChange([
          { value: 'region', label: 'region' },
          { value: 'zone', label: 'zone' },
        ]);
      });

      expect(variable.state.originFilters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'region', operator: 'groupBy', origin: 'dashboard' }),
          expect.objectContaining({ key: 'zone', operator: 'groupBy', origin: 'dashboard' }),
        ])
      );
    });

    it('adhoc controller should not have enableGroupBy property', async () => {
      config.featureToggles.adHocFilterDefaultValues = true;
      config.featureToggles.dashboardUnifiedDrilldownControls = true;
      getGroupByKeysMock = () => Promise.resolve([]);

      const { renderer } = await setup(undefined, { enableGroupBy: true });

      await waitFor(() => {
        expect(renderer.getByTestId('origin-filters-editor')).toBeInTheDocument();
      });

      expect(capturedOriginController).toBeDefined();
      const state = capturedOriginController!.useState();
      expect(state.enableGroupBy).toBe(false);
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

interface SetupOptions {
  withDefaultKeys?: boolean;
  enableGroupBy?: boolean;
}

async function setup(props?: React.ComponentProps<typeof AdHocFiltersVariableEditor>, options: SetupOptions = {}) {
  const { withDefaultKeys = false, enableGroupBy } = options;
  const onRunQuery = jest.fn();
  const variable = new AdHocFiltersVariable({
    name: 'adhocVariable',
    type: 'adhoc',
    label: 'Filter',
    description: 'Filters are applied automatically to all queries that target this data source',
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
    enableGroupBy,
  });
  const renderer = await act(async () => {
    const result = render(<AdHocFiltersVariableEditor variable={variable} onRunQuery={onRunQuery} {...props} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return result;
  });
  return {
    renderer,
    variable,
    user: userEvent.setup(),
    mocks: { onRunQuery },
  };
}
