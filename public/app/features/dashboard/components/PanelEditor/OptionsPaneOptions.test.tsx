import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  LoadingState,
  PanelData,
  PanelPlugin,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { mockStandardFieldConfigOptions } from '../../../../../test/helpers/fieldConfig';
import { selectors } from '@grafana/e2e-selectors';
import { OptionsPaneOptions } from './OptionsPaneOptions';
import { DashboardModel, PanelModel } from '../../state';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';

standardFieldConfigEditorRegistry.setInit(() => mockStandardFieldConfigOptions());
standardEditorsRegistry.setInit(() => mockStandardFieldConfigOptions());
const mockStore = configureMockStore<any, any>();
const OptionsPaneSelector = selectors.components.PanelEditor.OptionsPane;

class OptionsPaneOptionsTestScenario {
  onFieldConfigsChange = jest.fn();
  onPanelOptionsChanged = jest.fn();
  onPanelConfigChange = jest.fn();

  panelData: PanelData = {
    series: [],
    state: LoadingState.Done,
    timeRange: {} as any,
  };
  plugin = new PanelPlugin(() => null).useFieldConfig();
  panel = new PanelModel({
    type: 'plugin',
    fieldConfig: {
      defaults: {
        max: 100,
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 100, color: 'green' },
          ],
        },
      },
      overrides: [],
    },
    options: {},
  });

  dashboard = new DashboardModel({});
  store = mockStore({
    dashboard: { panels: [] },
    templating: {
      variables: {},
    },
  });

  render() {
    render(
      <Provider store={this.store}>
        <OptionsPaneOptions
          data={this.panelData}
          plugin={this.plugin}
          panel={this.panel}
          dashboard={this.dashboard}
          onFieldConfigsChange={this.onFieldConfigsChange}
          onPanelConfigChange={this.onPanelConfigChange}
          onPanelOptionsChanged={this.onPanelOptionsChanged}
        />
      </Provider>
    );
  }
}

describe('OptionsPaneOptions', () => {
  it('should render panel frame options', async () => {
    const scenario = new OptionsPaneOptionsTestScenario();
    scenario.render();

    const editors = screen.queryAllByLabelText(OptionsPaneSelector.fieldLabel('Panel frame Title'));
    expect(editors).toHaveLength(1);
  });

  it('should render all categories', async () => {
    const scenario = new OptionsPaneOptionsTestScenario();
    scenario.render();

    expect(screen.getByRole('heading', { name: /Panel frame/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Standard options/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Thresholds/ })).toBeInTheDocument();
  });
});
