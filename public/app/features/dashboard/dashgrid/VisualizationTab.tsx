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
    const { angularPanel } = this.props;

    if (angularPanel) {
      const scope = angularPanel.getScope();
      const panelCtrl = scope.$$childHead.ctrl;

      const loader = getAngularLoader();
      const template = '<panel-editor-tab editor-tab="tab" ctrl="ctrl"></panel-editor-tab>';
      const scopeProps = { ctrl: panelCtrl, tab: panelCtrl.editorTabs[2] };

      this.angularOptions = loader.load(this.element, scopeProps, template);
    }
  }

  componentWillUnmount() {
    if (this.angularOptions) {
      this.angularOptions.destroy();
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
