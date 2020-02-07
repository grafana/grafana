import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, FieldConfigSource, PanelData, LoadingState, DefaultTimeRange } from '@grafana/data';
import { stylesFactory, Forms, FieldConfigEditor } from '@grafana/ui';
import config from 'app/core/config';

import { PanelModel } from '../../state/PanelModel';
import { DashboardModel } from '../../state/DashboardModel';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';
import { QueriesTab } from '../../panel_editor/QueriesTab';
import { StoreState } from '../../../../types/store';
import { connect } from 'react-redux';
import { updateLocation } from '../../../../core/reducers/location';
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
  updateLocation: typeof updateLocation;
}

interface State {
  dirtyPanel?: PanelModel;
  data: PanelData;
}

export class PanelEditor extends PureComponent<Props, State> {
  querySubscription: Unsubscribable;

  state: State = {
    data: {
      state: LoadingState.NotStarted,
      series: [],
      timeRange: DefaultTimeRange,
    },
  };

  componentDidMount() {
    const { panel } = this.props;
    const dirtyPanel = panel.getEditClone();
    this.setState({ dirtyPanel });

    // Listen for queries on the new panel
    const queryRunner = dirtyPanel.getQueryRunner();
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

  onPanelUpdate = () => {
    const { dirtyPanel } = this.state;
    const { dashboard } = this.props;
    dashboard.updatePanel(dirtyPanel);
  };

  onPanelExit = () => {
    const { updateLocation } = this.props;
    this.onPanelUpdate();
    updateLocation({
      query: { editPanel: null },
      partial: true,
    });
  };

  onDiscard = () => {
    this.props.updateLocation({
      query: { editPanel: null },
      partial: true,
    });
  };

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
    const { plugin } = panel;
    const fieldOptions = panel.options['fieldOptions'] as FieldConfigSource;
    if (!fieldOptions || !plugin) {
      return null;
    }

    return (
      <div>
        <FieldConfigEditor
          theme={config.theme}
          config={fieldOptions}
          custom={plugin.customFieldConfigs}
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
    if (!plugin) {
      return null; // not yet ready
    }

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
      <>
        <div className={styles.wrapper}>
          <div className={styles.leftPane}>
            <div className={styles.leftPaneViz}>
              <DashboardPanel
                dashboard={dashboard}
                panel={dirtyPanel}
                isEditing={false}
                isInEditMode
                isFullscreen={false}
                isInView={true}
              />
            </div>
            <div className={styles.leftPaneData}>
              <QueriesTab panel={dirtyPanel} dashboard={dashboard} />
            </div>
          </div>
          <div className={styles.rightPane}>
            <div>
              <Forms.Button variant="destructive" onClick={this.onDiscard}>
                Discard
              </Forms.Button>
              <Forms.Button onClick={this.onPanelExit}>Exit</Forms.Button>
            </div>

            <div>
              <h3>TODO: VizType picker</h3>
            </div>
            {this.renderFieldOptions()}
            {this.renderVisSettings()}
          </div>
        </div>
      </>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  location: state.location,
});

const mapDispatchToProps = {
  updateLocation,
};

export default connect(mapStateToProps, mapDispatchToProps)(PanelEditor);
