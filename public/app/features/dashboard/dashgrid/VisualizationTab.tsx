// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';

// Components
import { EditorTabBody } from './EditorTabBody';
import { VizTypePicker } from './VizTypePicker';

// Types
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { PanelPlugin } from 'app/types/plugins';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  angularPanel?: AngularComponent;
  onTypeChanged: (newType: PanelPlugin) => void;
}

export class VisualizationTab extends PureComponent<Props> {
  element: HTMLElement;
  angularOptions: AngularComponent;

  constructor(props) {
    super(props);
  }

  renderPanelOptions() {
    const { plugin, panel, angularPanel } = this.props;
    const { PanelOptions } = plugin.exports;

    if (angularPanel) {
      return <div ref={element => (this.element = element)} />;
    }

    if (PanelOptions) {
      return <PanelOptions options={panel.getOptions()} onChange={this.onPanelOptionsChanged} />;
    } else {
      return <p>Visualization has no options</p>;
    }
  }

  componentDidMount() {
    if (this.shouldLoadAngularOptions()) {
      this.loadAngularOptions();
    }
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

    const panelCtrl = scope.$$childHead.ctrl;

    let template = '';
    for (let i = 0; i < panelCtrl.editorTabs.length; i++) {
      template += '<panel-editor-tab editor-tab="ctrl.editorTabs[' + i + ']" ctrl="ctrl"></panel-editor-tab>';
    }

    const loader = getAngularLoader();
    const scopeProps = { ctrl: panelCtrl };

    this.angularOptions = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    this.cleanUpAngularOptions();
  }

  cleanUpAngularOptions() {
    if (this.angularOptions) {
      this.angularOptions.destroy();
      this.angularOptions = null;
    }
  }

  onPanelOptionsChanged = (options: any) => {
    this.props.panel.updateOptions(options);
    this.forceUpdate();
  };

  render() {
    const { plugin } = this.props;

    const panelSelection = {
      title: plugin.name,
      imgSrc: plugin.info.logos.small,
      render: () => {
        // the needs to be scoped inside this closure
        const { plugin, onTypeChanged } = this.props;
        return <VizTypePicker current={plugin} onTypeChanged={onTypeChanged} />;
      },
    };

    return (
      <EditorTabBody main={panelSelection} toolbarItems={[]}>
        {this.renderPanelOptions()}
      </EditorTabBody>
    );
  }
}
