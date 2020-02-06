// Libraries
import React, { PureComponent } from 'react';
// Utils & Services
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';
import { updateLocation } from 'app/core/actions';
// Components
import { EditorTabBody, EditorToolbarView } from './EditorTabBody';
import { VizTypePicker } from './VizTypePicker';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { FadeIn } from 'app/core/components/Animations/FadeIn';
// Types
import { PanelModel, DashboardModel } from '../state';
import { VizPickerSearch } from './VizPickerSearch';
import PluginStateinfo from 'app/features/plugins/PluginStateInfo';
import { PanelCtrl } from 'app/plugins/sdk';
import { Unsubscribable } from 'rxjs';
import { PanelPlugin, PanelPluginMeta, PanelData, LoadingState, DefaultTimeRange } from '@grafana/data';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  angularPanel?: AngularComponent;
  onPluginTypeChange: (newType: PanelPluginMeta) => void;
  updateLocation: typeof updateLocation;
  urlOpenVizPicker: boolean;
}

interface State {
  isVizPickerOpen: boolean;
  searchQuery: string;
  scrollTop: number;
  hasBeenFocused: boolean;
  data: PanelData;
}

export class VisualizationTab extends PureComponent<Props, State> {
  element: HTMLElement;
  angularOptions: AngularComponent;
  querySubscription: Unsubscribable;

  constructor(props: Props) {
    super(props);

    this.state = {
      isVizPickerOpen: this.props.urlOpenVizPicker,
      hasBeenFocused: false,
      searchQuery: '',
      scrollTop: 0,
      data: {
        state: LoadingState.NotStarted,
        series: [],
        timeRange: DefaultTimeRange,
      },
    };
  }

  getReactPanelOptions = () => {
    const { panel } = this.props;
    return panel.getOptions();
  };

  renderPanelOptions() {
    const { plugin, angularPanel } = this.props;

    if (angularPanel) {
      return <div ref={element => (this.element = element)} />;
    }

    if (plugin.editor) {
      return (
        <plugin.editor
          data={this.state.data}
          options={this.getReactPanelOptions()}
          onOptionsChange={this.onPanelOptionsChanged}
        />
      );
    }

    return <p>Visualization has no options</p>;
  }

  componentDidMount() {
    const { panel } = this.props;
    const queryRunner = panel.getQueryRunner();
    if (this.shouldLoadAngularOptions()) {
      this.loadAngularOptions();
    }

    this.querySubscription = queryRunner.getData().subscribe({
      next: (data: PanelData) => this.setState({ data }),
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.plugin !== prevProps.plugin) {
      this.cleanUpAngularOptions();
    }

    if (this.shouldLoadAngularOptions()) {
      this.loadAngularOptions();
    }
  }

  shouldLoadAngularOptions() {
    return this.props.angularPanel && this.element && !this.angularOptions;
  }

  loadAngularOptions() {
    const { angularPanel } = this.props;

    const scope = angularPanel.getScope();

    // When full page reloading in edit mode the angular panel has on fully compiled & instantiated yet
    if (!scope.$$childHead) {
      setTimeout(() => {
        this.forceUpdate();
      });
      return;
    }

    const panelCtrl: PanelCtrl = scope.$$childHead.ctrl;
    panelCtrl.initEditMode();
    panelCtrl.onPluginTypeChange = this.onPluginTypeChange;

    let template = '';
    for (let i = 0; i < panelCtrl.editorTabs.length; i++) {
      template +=
        `
      <div class="panel-options-group" ng-cloak>` +
        (i > 0
          ? `<div class="panel-options-group__header">
           <span class="panel-options-group__title">{{ctrl.editorTabs[${i}].title}}
           </span>
         </div>`
          : '') +
        `<div class="panel-options-group__body">
          <panel-editor-tab editor-tab="ctrl.editorTabs[${i}]" ctrl="ctrl"></panel-editor-tab>
        </div>
      </div>
      `;
    }

    const loader = getAngularLoader();
    const scopeProps = { ctrl: panelCtrl };

    this.angularOptions = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
    }
    this.cleanUpAngularOptions();
  }

  cleanUpAngularOptions() {
    if (this.angularOptions) {
      this.angularOptions.destroy();
      this.angularOptions = null;
    }
  }

  clearQuery = () => {
    this.setState({ searchQuery: '' });
  };

  onPanelOptionsChanged = (options: any, callback?: () => void) => {
    this.props.panel.updateOptions(options);
    this.forceUpdate(callback);
  };

  onOpenVizPicker = () => {
    this.setState({ isVizPickerOpen: true, scrollTop: 0 });
  };

  onCloseVizPicker = () => {
    if (this.props.urlOpenVizPicker) {
      this.props.updateLocation({ query: { openVizPicker: null }, partial: true });
    }

    this.setState({ isVizPickerOpen: false, hasBeenFocused: false });
  };

  onSearchQueryChange = (value: string) => {
    this.setState({
      searchQuery: value,
    });
  };

  renderToolbar = (): JSX.Element => {
    const { plugin } = this.props;
    const { isVizPickerOpen, searchQuery } = this.state;
    const { meta } = plugin;

    if (isVizPickerOpen) {
      return (
        <VizPickerSearch
          plugin={meta}
          searchQuery={searchQuery}
          onChange={this.onSearchQueryChange}
          onClose={this.onCloseVizPicker}
        />
      );
    } else {
      return (
        <>
          <div className="toolbar__main" onClick={this.onOpenVizPicker}>
            <img className="toolbar__main-image" src={meta.info.logos.small} />
            <div className="toolbar__main-name">{meta.name}</div>
            <i className="fa fa-caret-down" />
          </div>
          <PluginStateinfo state={meta.state} />
        </>
      );
    }
  };

  onPluginTypeChange = (plugin: PanelPluginMeta) => {
    if (plugin.id === this.props.plugin.meta.id) {
      this.setState({ isVizPickerOpen: false });
    } else {
      this.props.onPluginTypeChange(plugin);
    }
  };

  renderHelp = () => <PluginHelp plugin={this.props.plugin.meta} type="help" />;

  setScrollTop = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    this.setState({ scrollTop: target.scrollTop });
  };

  render() {
    const { plugin } = this.props;
    const { isVizPickerOpen, searchQuery, scrollTop } = this.state;
    const { meta } = plugin;

    const pluginHelp: EditorToolbarView = {
      heading: 'Help',
      icon: 'fa fa-question',
      render: this.renderHelp,
    };

    return (
      <EditorTabBody
        heading="Visualization"
        renderToolbar={this.renderToolbar}
        toolbarItems={[pluginHelp]}
        scrollTop={scrollTop}
        setScrollTop={this.setScrollTop}
      >
        <>
          <FadeIn in={isVizPickerOpen} duration={200} unmountOnExit={true} onExited={this.clearQuery}>
            <VizTypePicker
              current={meta}
              onTypeChange={this.onPluginTypeChange}
              searchQuery={searchQuery}
              onClose={this.onCloseVizPicker}
            />
          </FadeIn>
          {this.renderPanelOptions()}
        </>
      </EditorTabBody>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  urlOpenVizPicker: !!state.location.query.openVizPicker,
});

const mapDispatchToProps = {
  updateLocation,
};

export default connectWithStore(VisualizationTab, mapStateToProps, mapDispatchToProps);
