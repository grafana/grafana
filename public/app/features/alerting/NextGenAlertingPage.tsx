import React, { FormEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Button, Icon, stylesFactory } from '@grafana/ui';
import { PageToolbar } from 'app/core/components/PageToolbar/PageToolbar';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import AlertingQueryEditor from './components/AlertingQueryEditor';
import { AlertDefinitionOptions } from './components/AlertDefinitionOptions';
import { AlertingQueryPreview } from './components/AlertingQueryPreview';
import {
  updateAlertDefinitionOption,
  createAlertDefinition,
  updateAlertDefinitionUiState,
  loadNotificationTypes,
} from './state/actions';
import { AlertDefinition, AlertDefinitionUiState, NotificationChannelType, StoreState } from '../../types';

import { config } from 'app/core/config';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';

interface OwnProps {}

interface ConnectedProps {
  alertDefinition: AlertDefinition;
  uiState: AlertDefinitionUiState;
  notificationChannelTypes: NotificationChannelType[];
  queryRunner: PanelQueryRunner;
}

interface DispatchProps {
  createAlertDefinition: typeof createAlertDefinition;
  updateAlertDefinitionUiState: typeof updateAlertDefinitionUiState;
  updateAlertDefinitionOption: typeof updateAlertDefinitionOption;
  loadNotificationTypes: typeof loadNotificationTypes;
}

interface State {}

type Props = OwnProps & ConnectedProps & DispatchProps;

class NextGenAlertingPage extends PureComponent<Props, State> {
  state = { dataSources: [] };

  componentDidMount() {
    this.props.loadNotificationTypes();
  }

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
      <Button variant="secondary" key="test" onClick={this.onTest}>
        Test
      </Button>,
      <Button variant="primary" key="save" onClick={this.onSaveAlert}>
        Save
      </Button>,
    ];
  }

  render() {
    const {
      alertDefinition,
      notificationChannelTypes,
      uiState,
      updateAlertDefinitionUiState,
      queryRunner,
    } = this.props;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <PageToolbar
          title="Alert editor"
          titlePrefix={<Icon name="bell" size="lg" />}
          actions={this.renderToolbarActions()}
          titlePadding="sm"
        />
        <div className={styles.splitPanesWrapper}>
          <SplitPaneWrapper
            leftPaneComponents={[
              <AlertingQueryPreview key="queryPreview" queryRunner={queryRunner} />,
              <AlertingQueryEditor key="queryEditor" />,
            ]}
            uiState={uiState}
            updateUiState={updateAlertDefinitionUiState}
            rightPaneComponents={
              <AlertDefinitionOptions
                alertDefinition={alertDefinition}
                onChange={this.onChangeAlertOption}
                notificationChannelTypes={notificationChannelTypes}
              />
            }
          />
        </div>
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state) => {
  return {
    uiState: state.alertDefinition.uiState,
    alertDefinition: state.alertDefinition.alertDefinition,
    notificationChannelTypes: state.notificationChannel.notificationChannelTypes,
    queryRunner: state.alertDefinition.queryRunner,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  createAlertDefinition,
  updateAlertDefinitionUiState,
  updateAlertDefinitionOption,
  loadNotificationTypes,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(NextGenAlertingPage));

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    width: 100%;
    height: 100%;
    position: fixed;
    z-index: ${theme.zIndex.sidemenu};
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${theme.colors.dashboardBg};
    display: flex;
    flex-direction: column;
  `,
  splitPanesWrapper: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    position: relative;
  `,
}));
