import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, fireEvent, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { render } from 'test/test-utils';

import {
  LoadingState,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  type PanelData,
  type TimeRange,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FlagKeys } from '@grafana/runtime/internal';
import { TableCellDisplayMode } from '@grafana/schema';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { OptionsPaneOptions } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';

import { plugin } from './module';

// building the plugin's fieldConfigRegistry runs the table useCustomConfig path, which resolves
// standard editors; initialise both registries so this file does not depend on another test
standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

const mockStore = configureMockStore();
const OptionsPaneSelector = selectors.components.PanelEditor.OptionsPane;

// The panel from the issue: a table panel with sparkline cells, edited in the options pane
function setupTablePanel() {
  const panelData: PanelData = {
    series: [],
    state: LoadingState.Done,
    timeRange: {} as TimeRange,
  };

  const panel = new PanelModel({
    title: 'Sparklines',
    type: plugin.meta.id,
    fieldConfig: {
      defaults: {
        custom: {
          cellOptions: { type: TableCellDisplayMode.Sparkline },
          // migrations would provide this for real panels; the footer StatsPicker needs it
          'footer.reducers': [],
        },
      },
      overrides: [],
    },
    options: {},
  });

  const store = mockStore({
    dashboard: { panels: [] },
    templating: { variables: {} },
  });

  return async function setup() {
    await act(async () => {
      render(
        <OpenFeatureProvider client={getTestFeatureFlagClient()}>
          <Provider store={store}>
            <OptionsPaneOptions
              data={panelData}
              plugin={plugin}
              panel={panel}
              dashboard={createDashboardModelFixture()}
              onFieldConfigsChange={jest.fn()}
              onPanelConfigChange={jest.fn()}
              onPanelOptionsChanged={jest.fn()}
              instanceState={undefined}
            />
          </Provider>
        </OpenFeatureProvider>
      );
    });
  };
}

describe('table cell options in the panel options search', () => {
  afterEach(async () => {
    // the OpenFeature provider notifies subscribers, so wrap the reset like the flag updates above
    await act(async () => {
      setTestFlags({});
    });
  });

  function searchOptions(query: string) {
    const input = screen.getByPlaceholderText('Search options');
    act(() => {
      fireEvent.change(input, { target: { value: query } });
      fireEvent.blur(input);
    });
  }

  // https://github.com/grafana/grafana/issues/136909
  it('finds the dependent "Hide value" sub-option of the sparkline cell type', async () => {
    setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: true });
    const setup = setupTablePanel();
    await setup();

    searchOptions('Hide value');

    expect(await screen.findByTestId(OptionsPaneSelector.fieldLabel('Cell options Cell type'))).toBeInTheDocument();
  });

  it('finds a cell type by its own name in the dropdown', async () => {
    setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: true });
    const setup = setupTablePanel();
    await setup();

    searchOptions('Colored background');

    expect(await screen.findByTestId(OptionsPaneSelector.fieldLabel('Cell options Cell type'))).toBeInTheDocument();
  });
});
