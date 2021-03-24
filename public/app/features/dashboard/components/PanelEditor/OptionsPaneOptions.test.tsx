import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoadingState, PanelData, standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { mockStandardFieldConfigOptions } from '../../../../../test/helpers/fieldConfig';
import { selectors } from '@grafana/e2e-selectors';
import { OptionsPaneOptions } from './OptionsPaneOptions';
import { DashboardModel, PanelModel } from '../../state';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

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
  plugin = getPanelPlugin({
    id: 'TestPanel',
  }).useFieldConfig({
    standardOptions: {},
    useCustomConfig: (b) => {
      b.addBooleanSwitch({
        name: 'CustomBool',
        path: 'CustomBool',
      })
        .addBooleanSwitch({
          name: 'HiddenFromDef',
          path: 'HiddenFromDef',
          hideFromDefaults: true,
        })
        .addTextInput({
          name: 'TextPropWithCategory',
          path: 'TextPropWithCategory',
          category: ['Axis'],
        });
    },
  });
  panel = new PanelModel({
    title: 'Test title',
    type: this.plugin.meta.id,
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

    expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('Panel frame Title'))).toBeInTheDocument();
  });

  it('should render all categories', async () => {
    const scenario = new OptionsPaneOptionsTestScenario();
    scenario.render();

    expect(screen.getByRole('heading', { name: /Panel frame/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Standard options/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Thresholds/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /TestPanel/ })).toBeInTheDocument();
  });

  it('should render custom  options', () => {
    const scenario = new OptionsPaneOptionsTestScenario();
    scenario.render();

    expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('TestPanel CustomBool'))).toBeInTheDocument();
  });

  it('should not render options that are marked as hidden from defaults', () => {
    const scenario = new OptionsPaneOptionsTestScenario();
    scenario.render();

    expect(screen.queryByLabelText(OptionsPaneSelector.fieldLabel('TestPanel HiddenFromDef'))).not.toBeInTheDocument();
  });

  it('should create categories for field options with category', () => {
    const scenario = new OptionsPaneOptionsTestScenario();
    scenario.render();

    expect(screen.getByRole('heading', { name: /Axis/ })).toBeInTheDocument();
  });

  it('should not render categories with hidden fields only', () => {
    const scenario = new OptionsPaneOptionsTestScenario();

    scenario.plugin = getPanelPlugin({
      id: 'TestPanel',
    }).useFieldConfig({
      standardOptions: {},
      useCustomConfig: (b) => {
        b.addBooleanSwitch({
          name: 'CustomBool',
          path: 'CustomBool',
          hideFromDefaults: true,
          category: ['Axis'],
        });
      },
    });

    scenario.render();
    expect(screen.queryByRole('heading', { name: /Axis/ })).not.toBeInTheDocument();
  });

  it('should call onPanelConfigChange when updating title', () => {
    const scenario = new OptionsPaneOptionsTestScenario();
    scenario.render();

    const input = screen.getByDisplayValue(scenario.panel.title);
    fireEvent.change(input, { target: { value: 'New' } });
    fireEvent.blur(input);

    expect(scenario.onPanelConfigChange).toHaveBeenCalledWith('title', 'New');
  });
});
