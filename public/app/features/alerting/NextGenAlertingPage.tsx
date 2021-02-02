import React, { FormEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { PageToolbar, stylesFactory, ToolbarButton } from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { connectWithCleanUp } from 'app/core/components/connectWithCleanUp';
import AlertingQueryEditor from './components/AlertingQueryEditor';
import { AlertDefinitionOptions } from './components/AlertDefinitionOptions';
import { AlertingQueryPreview } from './components/AlertingQueryPreview';
import {
  updateAlertDefinitionOption,
  createAlertDefinition,
  updateAlertDefinitionUiState,
  loadNotificationTypes,
} from './state/actions';
import {
  AlertDefinition,
  AlertDefinitionUiState,
  NotificationChannelType,
  QueryGroupOptions,
  StoreState,
} from '../../types';

import { config } from 'app/core/config';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';

interface OwnProps {}

interface ConnectedProps {
  alertDefinition: AlertDefinition;
  uiState: AlertDefinitionUiState;
  notificationChannelTypes: NotificationChannelType[];
  queryRunner: PanelQueryRunner;
  queryOptions: QueryGroupOptions;
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

  onChangeInterval = (interval: SelectableValue<number>) => {
    this.props.updateAlertDefinitionOption({
      interval: interval.value,
    });
  };

  onConditionChange = (condition: SelectableValue<string>) => {
    this.props.updateAlertDefinitionOption({
      condition: { ...this.props.alertDefinition.condition, refId: condition.value! },
    });
  };

  onSaveAlert = () => {
    const { createAlertDefinition } = this.props;

    createAlertDefinition();
  };

  onDiscard = () => {};

  onTest = () => {};

  renderToolbarActions() {
    return [
      <ToolbarButton variant="destructive" key="discard" onClick={this.onDiscard}>
        Discard
      </ToolbarButton>,
      <ToolbarButton key="test" onClick={this.onTest}>
        Test
      </ToolbarButton>,
      <ToolbarButton variant="primary" key="save" onClick={this.onSaveAlert}>
        Save
      </ToolbarButton>,
    ];
  }

  render() {
    const {
      alertDefinition,
      notificationChannelTypes,
      uiState,
      updateAlertDefinitionUiState,
      queryRunner,
      queryOptions,
    } = this.props;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <PageToolbar title="Alert editor" pageIcon="bell">
          {this.renderToolbarActions()}
        </PageToolbar>
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
                onIntervalChange={this.onChangeInterval}
                onConditionChange={this.onConditionChange}
                queryOptions={queryOptions}
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
    queryOptions: state.alertDefinition.queryOptions,
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

export default hot(module)(
  connectWithCleanUp(mapStateToProps, mapDispatchToProps, (state) => state.alertDefinition)(NextGenAlertingPage)
);

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    width: calc(100% - 55px);
    height: 100%;
    position: fixed;
    top: 0;
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
