import React, { FormEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Button, Icon, stylesFactory } from '@grafana/ui';
import { PageToolbar } from 'app/core/components/PageToolbar/PageToolbar';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { AlertingQueryEditor } from './components/AlertingQueryEditor';
import { AlertDefinitionOptions } from './components/AlertDefinitionOptions';
import { AlertingQueryPreview } from './components/AlertingQueryPreview';
import { updateAlertDefinitionOption, createAlertDefinition, updateAlertDefinitionUiState } from './state/actions';
import { AlertDefinition, AlertDefinitionUiState, StoreState } from '../../types';

import { config } from 'app/core/config';

interface OwnProps {}

interface ConnectedProps {
  alertDefinition: AlertDefinition;
  uiState: AlertDefinitionUiState;
}

interface DispatchProps {
  createAlertDefinition: typeof createAlertDefinition;
  updateAlertDefinitionUiState: typeof updateAlertDefinitionUiState;
  updateAlertDefinitionOption: typeof updateAlertDefinitionOption;
}

interface State {}

type Props = OwnProps & ConnectedProps & DispatchProps;

class NextGenAlertingPage extends PureComponent<Props, State> {
  state = { dataSources: [] };

  onChangeAlertOption = (event: FormEvent<HTMLFormElement>) => {
    this.props.updateAlertDefinitionOption({ [event.currentTarget.name]: event.currentTarget.value });
  };

  onSaveAlert = () => {
    const { createAlertDefinition } = this.props;

    createAlertDefinition();
  };

  onDiscard = () => {};

  onTest = () => {};

  renderToolbarActions() {
    return [
      <Button variant="destructive" key="discard" onClick={this.onDiscard}>
        Discard
      </Button>,
      <Button variant="primary" key="save" onClick={this.onSaveAlert}>
        Save
      </Button>,
      <Button variant="secondary" key="test" onClick={this.onTest}>
        Test
      </Button>,
    ];
  }

  render() {
    const { uiState, updateAlertDefinitionUiState, alertDefinition } = this.props;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <PageToolbar
          title="Alert editor"
          titlePrefix={<Icon name="bell" size="lg" />}
          actions={this.renderToolbarActions()}
          titlePadding="sm"
        />
        <SplitPaneWrapper
          leftPaneComponents={[<AlertingQueryPreview key="queryPreview" />, <AlertingQueryEditor key="queryEditor" />]}
          uiState={uiState}
          updateUiState={updateAlertDefinitionUiState}
          rightPaneComponents={
            <AlertDefinitionOptions alertDefinition={alertDefinition} onChange={this.onChangeAlertOption} />
          }
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
  updateAlertDefinitionOption,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(NextGenAlertingPage));

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      background-color: ${theme.colors.dashboardBg};
    `,
  };
});
