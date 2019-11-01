// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelData, DataQuery, DataSourceSelectItem } from '@grafana/data';
import { QueriesForResolution } from './types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { QueryEditorRows } from 'app/features/dashboard/panel_editor/QueryEditorRows';
import kbn from 'app/core/utils/kbn';
import { css } from 'emotion';
import classNames from 'classnames';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  data: PanelData;
  value: QueriesForResolution;
  onScrollBottom: () => void;
  onDuplicate: (value: QueriesForResolution) => void;
  onChange: (value: QueriesForResolution) => void;
  onDelete?: (value: QueriesForResolution) => void;
  mixed: DataSourceSelectItem;
  isCurrent: boolean;
  currentTime: number;
}

type State = {
  isCollapsed: boolean;
};

export class MultiQueryRow extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isCollapsed: false,
    };
  }

  toggleCollapse = () => {
    this.setState({
      isCollapsed: !this.state.isCollapsed,
    });
  };

  onDuplicate = () => {
    this.props.onDuplicate(this.props.value);
  };

  onRemove = () => {
    this.props.onDelete!(this.props.value);
  };

  onChangeQueries = (targets: DataQuery[]) => {
    const { value, onChange } = this.props;
    onChange({
      ...value,
      targets,
    });
  };

  onSetTimeToNow = () => {
    const { value, onChange, currentTime } = this.props;
    console.log('SET TIME:', currentTime, value);
    onChange({
      ...value,
      ms: currentTime,
    });
  };

  toggleToNow = () => {
    const { value, onChange } = this.props;
    onChange({
      ...value,
      now: !value.now,
    });
  };

  onTextChange = (event: any) => {
    const v = event.target.value;

    console.log('TXT', v);
  };

  onBlur = () => {
    const txt = '10ms';

    try {
      const ms = kbn.interval_to_ms(txt);
      if (ms) {
        console.log('SET', ms, txt);
      }
    } catch {}
  };

  render() {
    const { value, data, dashboard, panel, onScrollBottom, onDelete, mixed, isCurrent } = this.props;
    const { isCollapsed } = this.state;
    const xxx = css({
      fontSize: 16,
      fontWeight: 500,
      padding: '4px',
    });
    const yyy = isCurrent
      ? css({
          borderTop: '5px solid #33b5e5',
        })
      : '';
    return (
      <div className="query-editor-row">
        <div className={classNames('query-editor-row__header', yyy)}>
          <div onClick={this.toggleCollapse}>
            {isCollapsed && <i className="fa fa-caret-right" />}
            {!isCollapsed && <i className="fa fa-caret-down" />}
            <span>&nbsp;</span>
          </div>
          <div>
            <span className={xxx}>{value.ms}ms</span>
            {onDelete /* onDelete only exists with >1 rows */ && (
              <button className="query-editor-row__action" onClick={this.onSetTimeToNow} title="Edit">
                <i className="fa fa-fw fa-edit" />
              </button>
            )}
            <button className="query-editor-row__action" onClick={this.toggleToNow} title="Edit">
              <i className={value.now ? 'fa fa-fw fa-check-square-o' : 'fa fa-fw fa-square-o'} />
              Live
            </button>
          </div>
          <div className="query-editor-row__collapsed-text" onClick={this.toggleCollapse}>
            {isCollapsed && <div>TODO, describe queries? collapse them all?</div>}
          </div>
          <div className="query-editor-row__actions">
            <button className="query-editor-row__action" onClick={this.onDuplicate} title="Copy">
              <i className="fa fa-fw fa-copy" />
            </button>
            {onDelete && (
              <button className="query-editor-row__action" onClick={this.onRemove} title="Remove">
                <i className="fa fa-fw fa-trash" />
              </button>
            )}
          </div>
        </div>
        {!isCollapsed && (
          <div className="query-editor-row__body gf-form-query">
            <QueryEditorRows
              queries={value.targets}
              datasource={mixed}
              onChangeQueries={this.onChangeQueries}
              onScrollBottom={onScrollBottom}
              panel={panel}
              dashboard={dashboard}
              data={data}
            />
          </div>
        )}
      </div>
    );
  }
}
