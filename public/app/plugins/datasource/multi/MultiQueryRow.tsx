// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelData, DataQuery, DataSourceSelectItem } from '@grafana/ui';
import { QueriesForResolution } from './types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { QueryEditorRows } from 'app/features/dashboard/panel_editor/QueryEditorRows';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  data: PanelData;
  value: QueriesForResolution;
  onScrollBottom: () => void;
  onChange: (value: QueriesForResolution) => void;
  onDelete?: (value: QueriesForResolution) => void;
  mixed: DataSourceSelectItem;
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

  render() {
    const { value, data, dashboard, panel, onScrollBottom, onDelete, mixed } = this.props;
    const { isCollapsed } = this.state;
    return (
      <div className="query-editor-row">
        <div className="query-editor-row__header">
          <div onClick={this.toggleCollapse}>
            {isCollapsed && <i className="fa fa-caret-right" />}
            {!isCollapsed && <i className="fa fa-caret-down" />}
            <span>&nbsp;</span>
          </div>
          <div>
            <input type="text" className="gf-form query-editor-row__ref-id" defaultValue="XXX" />
          </div>
          <div className="query-editor-row__collapsed-text" onClick={this.toggleCollapse}>
            {isCollapsed && <div>XXXXX</div>}
          </div>
          <div className="query-editor-row__actions">
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
