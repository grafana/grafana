import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { DataSourceSelectItem, GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { AlertingToolbar } from './components/AlertingToolbar';
import { AlertingQueryEditor } from './components/AlertingQueryEditor';
import { AlertDefinitionOptions } from './components/AlertDefinitionOptions';
import { AlertingQueryPreview } from './components/AlertingQueryPreview';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { createAlertDefinition, updateAlertDefinitionUiState } from './state/actions';
import { AlertDefinition, AlertDefinitionUiState, StoreState } from '../../types';
import { SplitPaneWrapper } from '../../core/components/ThreePaneSplit/SplitPaneWrapper';
import { config } from 'app/core/config';

interface OwnProps {}

interface ConnectedProps {
  alertDefinition: AlertDefinition;
  uiState: AlertDefinitionUiState;
}

interface DispatchProps {
  createAlertDefinition: typeof createAlertDefinition;
  updateAlertDefinitionUiState: typeof updateAlertDefinitionUiState;
}

interface State {
  dataSources: DataSourceSelectItem[];
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class NextGenAlertingPage extends PureComponent<Props, State> {
  state = { dataSources: [] };

  componentDidMount() {
    const dataSources = getDatasourceSrv().getMetricSources();

    this.setState({
      dataSources,
    });
  }

  render() {
    const { uiState, updateAlertDefinitionUiState } = this.props;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <AlertingToolbar />
        <SplitPaneWrapper
          leftPaneComponents={[
            <AlertingQueryPreview key="queryPreview" />,
            <AlertingQueryEditor
              dataSources={this.state.dataSources}
              onChangeDataSource={() => {}}
              key="queryEditor"
            />,
          ]}
          uiState={uiState}
          updateUiState={updateAlertDefinitionUiState}
          rightPaneComponents={<AlertDefinitionOptions />}
        />
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    uiState: state.alertDefinition.uiState,
    alertDefinition: state.alertDefinition.alertDefinition,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  createAlertDefinition,
  updateAlertDefinitionUiState,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(NextGenAlertingPage));

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      background-color: ${theme.colors.dashboardBg};
    `,
  };
});
