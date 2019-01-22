import React, { PureComponent } from 'react';
import { ExploreId } from 'app/types/explore';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { DataSourceSelectItem, RawTimeRange, TimeRange } from '@grafana/ui';
import TimePicker from './TimePicker';

interface Props {
  datasourceMissing: boolean;
  exploreDatasources: DataSourceSelectItem[];
  exploreId: ExploreId;
  loading: boolean;
  range: RawTimeRange;
  selectedDatasource: DataSourceSelectItem;
  splitted: boolean;
  onChangeDatasource: (option) => void;
  onClearAll: () => void;
  onCloseSplit: () => void;
  onChangeTime: (range: TimeRange, changedByScanner?: boolean) => void;
  onRunQuery: () => void;
  onSplit: () => void;
}

export class ExploreToolbar extends PureComponent<Props, {}> {
  /**
   * Timepicker to control scanning
   */
  timepickerRef: React.RefObject<TimePicker>;

  constructor(props) {
    super(props);
    this.timepickerRef = React.createRef();
  }

  render() {
    const {
      datasourceMissing,
      exploreDatasources,
      exploreId,
      loading,
      range,
      selectedDatasource,
      splitted,
    } = this.props;

    return (
      <div className="navbar">
        {exploreId === 'left' ? (
          <div>
            <a className="navbar-page-btn">
              <i className="fa fa-rocket" />
              Explore
            </a>
          </div>
        ) : (
          <>
            <div className="navbar-page-btn" />
            <div className="navbar-buttons explore-first-button">
              <button className="btn navbar-button" onClick={this.props.onCloseSplit}>
                Close Split
              </button>
            </div>
          </>
        )}
        {!datasourceMissing ? (
          <div className="navbar-buttons">
            <DataSourcePicker
              onChange={this.props.onChangeDatasource}
              datasources={exploreDatasources}
              current={selectedDatasource}
            />
          </div>
        ) : null}
        <div className="navbar__spacer" />
        {exploreId === 'left' && !splitted ? (
          <div className="navbar-buttons">
            <button className="btn navbar-button" onClick={this.props.onSplit}>
              Split
            </button>
          </div>
        ) : null}
        <TimePicker ref={this.timepickerRef} range={range} onChangeTime={this.props.onChangeTime} />
        <div className="navbar-buttons">
          <button className="btn navbar-button navbar-button--no-icon" onClick={this.props.onClearAll}>
            Clear All
          </button>
        </div>
        <div className="navbar-buttons relative">
          <button className="btn navbar-button navbar-button--primary" onClick={this.props.onRunQuery}>
            Run Query{' '}
            {loading ? (
              <i className="fa fa-spinner fa-fw fa-spin run-icon" />
            ) : (
              <i className="fa fa-level-down fa-fw run-icon" />
            )}
          </button>
        </div>
      </div>
    );
  }
}
