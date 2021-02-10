import React, { FormEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { DataFrame, GrafanaTheme, SelectableValue } from '@grafana/data';
import { PageToolbar, stylesFactory, ToolbarButton } from '@grafana/ui';
import { config } from 'app/core/config';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import AlertingQueryEditor from './components/AlertingQueryEditor';
import { AlertDefinitionOptions } from './components/AlertDefinitionOptions';
import { AlertingQueryPreview } from './components/AlertingQueryPreview';
import {
  cleanUpDefinitionState,
  createAlertDefinition,
  evaluateAlertDefinition,
  evaluateNotSavedAlertDefinition,
  getAlertDefinition,
  onRunQueries,
  updateAlertDefinition,
  updateAlertDefinitionOption,
  updateAlertDefinitionUiState,
} from './state/actions';
import { getRouteParamsId } from 'app/core/selectors/location';
import { AlertDefinition, AlertDefinitionUiState, QueryGroupOptions, StoreState } from '../../types';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';

interface OwnProps {
  saveDefinition: typeof createAlertDefinition | typeof updateAlertDefinition;
}

interface ConnectedProps {
  uiState: AlertDefinitionUiState;
  queryRunner?: PanelQueryRunner;
  getQueryOptions: () => QueryGroupOptions;
  getInstances: () => DataFrame[];
  alertDefinition: AlertDefinition;
  pageId: string;
}

interface DispatchProps {
  updateAlertDefinitionUiState: typeof updateAlertDefinitionUiState;
  updateAlertDefinitionOption: typeof updateAlertDefinitionOption;
  evaluateAlertDefinition: typeof evaluateAlertDefinition;
  getAlertDefinition: typeof getAlertDefinition;
  updateAlertDefinition: typeof updateAlertDefinition;
  createAlertDefinition: typeof createAlertDefinition;
  evaluateNotSavedAlertDefinition: typeof evaluateNotSavedAlertDefinition;
  onRunQueries: typeof onRunQueries;
  cleanUpDefinitionState: typeof cleanUpDefinitionState;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class NextGenAlertingPage extends PureComponent<Props> {
  componentDidMount() {
    const { getAlertDefinition, pageId } = this.props;

    if (pageId) {
      getAlertDefinition(pageId);
    }
  }

  componentWillUnmount() {
    this.props.cleanUpDefinitionState();
  }

  onChangeAlertOption = (event: FormEvent<HTMLElement>) => {
    const formEvent = event as FormEvent<HTMLFormElement>;
    this.props.updateAlertDefinitionOption({ [formEvent.currentTarget.name]: formEvent.currentTarget.value });
  };

  onChangeInterval = (interval: SelectableValue<number>) => {
    this.props.updateAlertDefinitionOption({
      intervalSeconds: interval.value,
    });
  };

  onConditionChange = (condition: SelectableValue<string>) => {
    this.props.updateAlertDefinitionOption({
      condition: condition.value,
    });
  };

  onSaveAlert = () => {
    const { alertDefinition, createAlertDefinition, updateAlertDefinition } = this.props;

    if (alertDefinition.uid) {
      updateAlertDefinition();
    } else {
      createAlertDefinition();
    }
  };

  onDiscard = () => {};

  onTest = () => {
    const { alertDefinition, evaluateAlertDefinition, evaluateNotSavedAlertDefinition } = this.props;
    if (alertDefinition.uid) {
      evaluateAlertDefinition();
    } else {
      evaluateNotSavedAlertDefinition();
    }
  };

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
      getInstances,
      uiState,
      updateAlertDefinitionUiState,
      queryRunner,
      getQueryOptions,
      onRunQueries,
    } = this.props;

    const styles = getStyles(config.theme);
    const queryOptions = getQueryOptions();

    return (
      <div className={styles.wrapper}>
        <PageToolbar title="Alert editor" pageIcon="bell">
          {this.renderToolbarActions()}
        </PageToolbar>
        <div className={styles.splitPanesWrapper}>
          <SplitPaneWrapper
            leftPaneComponents={[
              <AlertingQueryPreview
                key="queryPreview"
                queryRunner={queryRunner!} // if the queryRunner is undefined here somethings very wrong so it's ok to throw an unhandled error
                getInstances={getInstances}
                queries={queryOptions.queries}
                onTest={this.onTest}
                onRunQueries={onRunQueries}
              />,
              <AlertingQueryEditor key="queryEditor" />,
            ]}
            uiState={uiState}
            updateUiState={updateAlertDefinitionUiState}
            rightPaneComponents={
              <AlertDefinitionOptions
                alertDefinition={alertDefinition}
                onChange={this.onChangeAlertOption}
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
  const pageId = getRouteParamsId(state.location);

  return {
    uiState: state.alertDefinition.uiState,
    getQueryOptions: state.alertDefinition.getQueryOptions,
    queryRunner: state.alertDefinition.queryRunner,
    getInstances: state.alertDefinition.getInstances,
    alertDefinition: state.alertDefinition.alertDefinition,
    pageId: (pageId as string) ?? '',
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  updateAlertDefinitionUiState,
  updateAlertDefinitionOption,
  evaluateAlertDefinition,
  updateAlertDefinition,
  createAlertDefinition,
  getAlertDefinition,
  evaluateNotSavedAlertDefinition,
  onRunQueries,
  cleanUpDefinitionState,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(NextGenAlertingPage));

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
