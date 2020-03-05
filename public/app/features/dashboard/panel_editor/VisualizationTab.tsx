// Libraries
import React, { PureComponent } from 'react';
// Utils & Services
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { updateLocation } from 'app/core/actions';
// Components
import { EditorTabBody, EditorToolbarView } from './EditorTabBody';
import { VizTypePicker } from './VizTypePicker';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { FadeIn } from 'app/core/components/Animations/FadeIn';
import { AngularPanelOptions } from './AngularPanelOptions';
// Types
import { PanelModel, DashboardModel } from '../state';
import { VizPickerSearch } from './VizPickerSearch';
import PluginStateinfo from 'app/features/plugins/PluginStateInfo';
import { Unsubscribable } from 'rxjs';
import { PanelPlugin, PanelPluginMeta, PanelData, LoadingState, DefaultTimeRange } from '@grafana/data';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
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
    const { plugin, dashboard, panel } = this.props;

    if (plugin.angularPanelCtrl) {
      return <AngularPanelOptions plugin={plugin} dashboard={dashboard} panel={panel} />;
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

    this.querySubscription = queryRunner.getData().subscribe({
      next: (data: PanelData) => this.setState({ data }),
    });
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
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

export default connect(mapStateToProps, mapDispatchToProps)(VisualizationTab);
