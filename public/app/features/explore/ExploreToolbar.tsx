import React, { PureComponent } from 'react';
import { ExploreId } from 'app/types/explore';
import { DataSourceSelectItem, RawTimeRange, TimeRange } from '@grafana/ui';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';

const createResponsiveButton = (options: {
  splitted: boolean;
  title: string;
  onClick: () => void;
  buttonClassName?: string;
  iconClassName?: string;
}) => {
  const { title, onClick, buttonClassName, iconClassName, splitted } = options;

  return (
    <button className={`btn navbar-button ${buttonClassName ? buttonClassName : ''}`} onClick={onClick}>
      <span className="btn-title">{!splitted ? title : ''}</span>
      {iconClassName ? <i className={iconClassName} /> : null}
    </button>
  );
};

interface Props {
  datasourceMissing: boolean;
  exploreDatasources: DataSourceSelectItem[];
  exploreId: ExploreId;
  loading: boolean;
  range: RawTimeRange;
  selectedDatasource: DataSourceSelectItem;
  splitted: boolean;
  timepicker: JSX.Element;
  onChangeDatasource: (option) => void;
  onClearAll: () => void;
  onCloseSplit: () => void;
  onChangeTime: (range: TimeRange, changedByScanner?: boolean) => void;
  onRunQuery: () => void;
  onSplit: () => void;
}

export class ExploreToolbar extends PureComponent<Props, {}> {
  constructor(props) {
    super(props);
  }

  render() {
    const {
      datasourceMissing,
      exploreDatasources,
      exploreId,
      loading,
      selectedDatasource,
      splitted,
      timepicker,
    } = this.props;

    return (
      <div className={splitted ? 'toolbar splitted' : 'toolbar'}>
        <div className="toolbar-item">
          <div className="toolbar-header">
            <div className="toolbar-header-title">
              {exploreId === 'left' && (
                <a className="navbar-page-btn">
                  <i className="fa fa-rocket fa-fw" />
                  Explore
                </a>
              )}
            </div>
            <div className="toolbar-header-close">
              {exploreId === 'right' && (
                <a onClick={this.props.onCloseSplit}>
                  <i className="fa fa-window-close fa-fw" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="toolbar-item">
          <div className="toolbar-content">
            {!datasourceMissing ? (
              <div className="toolbar-content-item">
                <div className="datasource-picker">
                  <DataSourcePicker
                    onChange={this.props.onChangeDatasource}
                    datasources={exploreDatasources}
                    current={selectedDatasource}
                  />
                </div>
              </div>
            ) : null}
            {exploreId === 'left' && !splitted ? (
              <div className="toolbar-content-item">
                {createResponsiveButton({
                  splitted,
                  title: 'Split',
                  onClick: this.props.onSplit,
                  iconClassName: 'fa fa-fw fa-columns',
                })}
              </div>
            ) : null}
            <div className="toolbar-content-item timepicker">{timepicker}</div>
            <div className="toolbar-content-item">
              <button className="btn navbar-button navbar-button--no-icon" onClick={this.props.onClearAll}>
                Clear All
              </button>
            </div>
            <div className="toolbar-content-item">
              {createResponsiveButton({
                splitted,
                title: 'Run Query',
                onClick: this.props.onRunQuery,
                buttonClassName: 'navbar-button--primary',
                iconClassName: loading ? 'fa fa-spinner fa-fw fa-spin run-icon' : 'fa fa-level-down fa-fw run-icon',
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
