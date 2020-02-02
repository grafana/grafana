import React, { PureComponent } from 'react';
import { css } from 'emotion';
import {
  GrafanaTheme,
  FieldConfigSource,
  FieldPropertyEditorItem,
  Registry,
  FieldConfigEditorRegistry,
  PanelData,
  LoadingState,
  DefaultTimeRange,
} from '@grafana/data';
import {
  stylesFactory,
  FieldConfigEditor,
  NumberValueEditor,
  NumberOverrideEditor,
  numberOverrideProcessor,
  NumberFieldConfigSettings,
} from '@grafana/ui';
import config from 'app/core/config';

import { PanelModel } from '../../state/PanelModel';
import { DashboardModel } from '../../state/DashboardModel';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';
import { QueriesTab } from '../../panel_editor/QueriesTab';
import { Unsubscribable } from 'rxjs';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    width: 100%;
    height: 100%;
    position: fixed;
    z-index: ${theme.zIndex.modal};
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${theme.colors.pageBg};
    display: flex;
    padding: ${theme.spacing.md};
    flex-direction: row;
  `,
  leftPane: css`
    flex-grow: 1;
    height: 100%;
  `,
  rightPane: css`
    width: 450px;
    height: 100%;
    flex-grow: 0;
    overflow: scroll;
  `,
  leftPaneViz: css`
    width: 100%;
    height: 50%;
  `,
  leftPaneData: css`
    width: 100%;
    height: 50%;
    padding-top: ${theme.spacing.md};
  `,
}));

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

interface State {
  dirtyPanel?: PanelModel;
  data: PanelData;
}

const columWidth: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
  id: 'width', // Match field properties
  name: 'Column Width',
  description: 'column width (for table)',

  editor: NumberValueEditor,
  override: NumberOverrideEditor,
  process: numberOverrideProcessor,

  settings: {
    placeholder: 'auto',
    min: 20,
    max: 300,
  },
};

export const customEditorRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>(() => {
  return [columWidth];
});

export class PanelEditor extends PureComponent<Props, State> {
  querySubscription: Unsubscribable;

  state: State = {
    data: {
      // TODO!! actually hook in the query response
      state: LoadingState.NotStarted,
      series: [],
      timeRange: DefaultTimeRange,
    },
  };

  componentDidMount() {
    const { panel } = this.props;
    const dirtyPanel = new PanelModel(panel.getSaveModel());
    this.setState({ dirtyPanel });

    const queryRunner = panel.getQueryRunner();
    // if (this.shouldLoadAngularOptions()) {
    //   this.loadAngularOptions();
    // }

    this.querySubscription = queryRunner.getData().subscribe({
      next: (data: PanelData) => this.setState({ data }),
    });
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
    }
    //this.cleanUpAngularOptions();
  }

  onFieldConfigsChange = (fieldOptions: FieldConfigSource) => {
    // NOTE: for now, assume this is from 'fieldOptions' -- TODO? put on panel model directly?
    const { panel } = this.props;
    const options = panel.getOptions();
    panel.updateOptions({
      ...options,
      fieldOptions, // Assume it is from shared singlestat -- TODO own property?
    });
  };

  renderFieldOptions() {
    const { panel } = this.props;
    const fieldOptions = panel.options['fieldOptions'] as FieldConfigSource;
    if (!fieldOptions) {
      return null;
    }

    return (
      <div>
        <FieldConfigEditor
          theme={config.theme}
          config={fieldOptions}
          custom={customEditorRegistry}
          onChange={this.onFieldConfigsChange}
          data={this.state.data.series}
        />
      </div>
    );
  }

  onPanelOptionsChanged = (options: any, callback?: () => void) => {
    this.props.panel.updateOptions(options);
    this.forceUpdate(callback);
  };

  /**
   * The existing visualization tab
   */
  renderVisSettings() {
    const { panel } = this.props;
    const { data } = this.state;
    const { plugin } = panel;
    if (plugin.editor) {
      return <plugin.editor data={data} options={panel.getOptions()} onOptionsChange={this.onPanelOptionsChanged} />;
    }

    return <div>No editor (angular?)</div>;
  }

  render() {
    const { dashboard } = this.props;
    const { dirtyPanel } = this.state;

    const styles = getStyles(config.theme);

    if (!dirtyPanel) {
      return null;
    }

    return (
      <div className={styles.wrapper}>
        <div className={styles.leftPane}>
          <div className={styles.leftPaneViz}>
            <DashboardPanel
              dashboard={dashboard}
              panel={dirtyPanel}
              isEditing={false}
              isFullscreen={false}
              isInView={true}
            />
          </div>
          <div className={styles.leftPaneData}>
            <QueriesTab panel={dirtyPanel} dashboard={dashboard} />;
          </div>
        </div>
        <div className={styles.rightPane}>
          <div>
            <h3>TODO: VizType picker</h3>
          </div>
          {this.renderFieldOptions()}
          {this.renderVisSettings()}
        </div>
      </div>
    );
  }
}
