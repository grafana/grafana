import React, { PureComponent } from 'react';
import { ExploreId } from 'app/types/explore';
import { DataSourceSelectItem, RawTimeRange, TimeRange } from '@grafana/ui';
import TimePicker from './TimePicker';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';

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
    this.createResponsiveButton = this.createResponsiveButton.bind(this);
    this.createDatasourcePicker = this.createDatasourcePicker.bind(this);
    this.createSplittedClassName = this.createSplittedClassName.bind(this);
  }

  createDatasourcePicker() {
    const { exploreDatasources, selectedDatasource } = this.props;

    return (
      <DataSourcePicker
        onChange={this.props.onChangeDatasource}
        datasources={exploreDatasources}
        current={selectedDatasource}
      />
    );
  }

  createResponsiveButton(options: {
    title: string;
    onClick: () => void;
    buttonClassName?: string;
    iconClassName?: string;
  }) {
    const { splitted } = this.props;
    const { title, onClick, buttonClassName, iconClassName } = options;

    return (
      <>
        <button className={`btn navbar-button large-screens ${buttonClassName && buttonClassName}`} onClick={onClick}>
          {!splitted ? title : ''}
          {iconClassName && <i className={iconClassName} />}
        </button>
        <button className={`btn navbar-button small-screens ${buttonClassName && buttonClassName}`} onClick={onClick}>
          {iconClassName && <i className={iconClassName} />}
        </button>
      </>
    );
  }

  createSplittedClassName(className: string) {
    const { splitted } = this.props;

    return splitted ? `${className}-splitted` : className;
  }

  render() {
    const { datasourceMissing, exploreId, loading, range, splitted } = this.props;
    const toolbar = this.createSplittedClassName('toolbar');
    const toolbarItem = this.createSplittedClassName('toolbar-item');
    const toolbarHeader = this.createSplittedClassName('toolbar-header');
    const timepickerLarge = this.createSplittedClassName('toolbar-content-item timepicker-large-screens');
    const timepickerSmall = this.createSplittedClassName('toolbar-content-item timepicker-small-screens');

    return (
      <div className={toolbar}>
        <div className={toolbarItem}>
          <div className={toolbarHeader}>
            <div className="toolbar-header-title">
              {exploreId === 'left' && (
                <a className="navbar-page-btn">
                  <i className="fa fa-rocket fa-fw" />
                  Explore
                </a>
              )}
            </div>
            <div className="toolbar-header-datasource large-screens">
              <div className="datasource-picker">
                {!datasourceMissing && !splitted ? this.createDatasourcePicker() : null}
              </div>
            </div>
            <div className="toolbar-header-close">
              {exploreId === 'right' && (
                <button className="btn navbar-button" onClick={this.props.onCloseSplit}>
                  Close Split
                </button>
              )}
            </div>
          </div>
        </div>
        <div className={toolbarItem}>
          {!datasourceMissing && splitted ? (
            <div className="datasource-picker">{this.createDatasourcePicker()}</div>
          ) : null}
        </div>
        <div className={toolbarItem}>
          <div className="toolbar-content">
            {!datasourceMissing && !splitted ? (
              <div className="toolbar-content-item small-screens">
                <div className="datasource-picker">{this.createDatasourcePicker()}</div>
              </div>
            ) : null}
            {exploreId === 'left' && !splitted ? (
              <div className="toolbar-content-item">
                {this.createResponsiveButton({
                  title: 'Split',
                  onClick: this.props.onSplit,
                  iconClassName: 'fa fa-fw fa-columns',
                })}
              </div>
            ) : null}
            <div className={timepickerLarge}>
              <TimePicker
                ref={this.timepickerRef}
                range={range}
                onChangeTime={this.props.onChangeTime}
                iconOnly={false}
              />
            </div>
            <div className={timepickerSmall}>
              <TimePicker
                ref={this.timepickerRef}
                range={range}
                onChangeTime={this.props.onChangeTime}
                iconOnly={true}
              />
            </div>
            <div className="toolbar-content-item">
              <button className="btn navbar-button navbar-button--no-icon" onClick={this.props.onClearAll}>
                Clear All
              </button>
            </div>
            <div className="toolbar-content-item">
              {this.createResponsiveButton({
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
