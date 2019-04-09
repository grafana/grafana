import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';

import { ExploreId } from 'app/types/explore';
import { DataSourceSelectItem, RawTimeRange, TimeRange } from '@grafana/ui';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { StoreState } from 'app/types/store';
import { changeDatasource, clearQueries, splitClose, runQueries, splitOpen } from './state/actions';
import TimePicker from './TimePicker';
import { ClickOutsideWrapper } from 'app/core/components/ClickOutsideWrapper/ClickOutsideWrapper';

enum IconSide {
  left = 'left',
  right = 'right',
}

const createResponsiveButton = (options: {
  splitted: boolean;
  title: string;
  onClick: () => void;
  buttonClassName?: string;
  iconClassName?: string;
  iconSide?: IconSide;
}) => {
  const defaultOptions = {
    iconSide: IconSide.left,
  };
  const props = { ...options, defaultOptions };
  const { title, onClick, buttonClassName, iconClassName, splitted, iconSide } = props;

  return (
    <button className={`btn navbar-button ${buttonClassName ? buttonClassName : ''}`} onClick={onClick}>
      {iconClassName && iconSide === IconSide.left ? <i className={`${iconClassName} icon-margin-right`} /> : null}
      <span className="btn-title">{!splitted ? title : ''}</span>
      {iconClassName && iconSide === IconSide.right ? <i className={`${iconClassName} icon-margin-left`} /> : null}
    </button>
  );
};

interface OwnProps {
  exploreId: ExploreId;
  timepickerRef: React.RefObject<TimePicker>;
  onChangeTime: (range: TimeRange, changedByScanner?: boolean) => void;
}

interface StateProps {
  datasourceMissing: boolean;
  exploreDatasources: DataSourceSelectItem[];
  loading: boolean;
  range: RawTimeRange;
  selectedDatasource: DataSourceSelectItem;
  splitted: boolean;
}

interface DispatchProps {
  changeDatasource: typeof changeDatasource;
  clearAll: typeof clearQueries;
  runQuery: typeof runQueries;
  closeSplit: typeof splitClose;
  split: typeof splitOpen;
}

type Props = StateProps & DispatchProps & OwnProps;

export class UnConnectedExploreToolbar extends PureComponent<Props, {}> {
  constructor(props) {
    super(props);
  }

  onChangeDatasource = async option => {
    this.props.changeDatasource(this.props.exploreId, option.value);
  };

  onClearAll = () => {
    this.props.clearAll(this.props.exploreId);
  };

  onRunQuery = () => {
    this.props.runQuery(this.props.exploreId);
  };

  onCloseTimePicker = () => {
    this.props.timepickerRef.current.setState({ isOpen: false });
  };

  render() {
    const {
      datasourceMissing,
      exploreDatasources,
      exploreId,
      loading,
      range,
      selectedDatasource,
      splitted,
      timepickerRef,
    } = this.props;

    return (
      <div className={splitted ? 'explore-toolbar splitted' : 'explore-toolbar'}>
        <div className="explore-toolbar-item">
          <div className="explore-toolbar-header">
            <div className="explore-toolbar-header-title">
              {exploreId === 'left' && (
                <span className="navbar-page-btn">
                  <i className="gicon gicon-explore" />
                  Explore
                </span>
              )}
            </div>
            {splitted && (
              <a className="explore-toolbar-header-close" onClick={() => this.props.closeSplit(exploreId)}>
                <i className="fa fa-times fa-fw" />
              </a>
            )}
          </div>
        </div>
        <div className="explore-toolbar-item">
          <div className="explore-toolbar-content">
            {!datasourceMissing ? (
              <div className="explore-toolbar-content-item">
                <div className="datasource-picker">
                  <DataSourcePicker
                    onChange={this.onChangeDatasource}
                    datasources={exploreDatasources}
                    current={selectedDatasource}
                  />
                </div>
              </div>
            ) : null}
            {exploreId === 'left' && !splitted ? (
              <div className="explore-toolbar-content-item">
                {createResponsiveButton({
                  splitted,
                  title: 'Split',
                  onClick: this.props.split,
                  iconClassName: 'fa fa-fw fa-columns icon-margin-right',
                  iconSide: IconSide.left,
                })}
              </div>
            ) : null}
            <div className="explore-toolbar-content-item timepicker">
              <ClickOutsideWrapper onClick={this.onCloseTimePicker}>
                <TimePicker ref={timepickerRef} range={range} onChangeTime={this.props.onChangeTime} />
              </ClickOutsideWrapper>
            </div>
            <div className="explore-toolbar-content-item">
              <button className="btn navbar-button navbar-button--no-icon" onClick={this.onClearAll}>
                Clear All
              </button>
            </div>
            <div className="explore-toolbar-content-item">
              {createResponsiveButton({
                splitted,
                title: 'Run Query',
                onClick: this.onRunQuery,
                buttonClassName: 'navbar-button--secondary',
                iconClassName: loading ? 'fa fa-spinner fa-fw fa-spin run-icon' : 'fa fa-level-down fa-fw run-icon',
                iconSide: IconSide.right,
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState, { exploreId }: OwnProps): StateProps => {
  const splitted = state.explore.split;
  const exploreItem = state.explore[exploreId];
  const { datasourceInstance, datasourceMissing, exploreDatasources, queryTransactions, range } = exploreItem;
  const selectedDatasource = datasourceInstance
    ? exploreDatasources.find(datasource => datasource.name === datasourceInstance.name)
    : undefined;
  const loading = queryTransactions.some(qt => !qt.done);

  return {
    datasourceMissing,
    exploreDatasources,
    loading,
    range,
    selectedDatasource,
    splitted,
  };
};

const mapDispatchToProps: DispatchProps = {
  changeDatasource,
  clearAll: clearQueries,
  runQuery: runQueries,
  closeSplit: splitClose,
  split: splitOpen,
};

export const ExploreToolbar = hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UnConnectedExploreToolbar)
);
