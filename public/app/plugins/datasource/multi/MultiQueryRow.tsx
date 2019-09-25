// Libraries
import React, { PureComponent } from 'react';
import defaults from 'lodash/defaults';

// Types
import { PanelData, DataQuery } from '@grafana/ui';
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

  render() {
    const { data, dashboard, panel, onScrollBottom } = this.props;
    const isCollapsed = true;
    const value: QueriesForResolution = defaults(this.props.value, {
      targets: [{ refId: 'A' }],
    } as QueriesForResolution);

    console.log('MULTI', value);

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
          <div
            className="query-editor-row__collapsed-text"
            onClick={() => {
              console.log('toggle');
            }}
          >
            {isCollapsed && <div>XXXXX</div>}
          </div>
          <div className="query-editor-row__actions">
            <button
              className="query-editor-row__action"
              onClick={() => {
                console.log('remove');
              }}
              title="Remove"
            >
              <i className="fa fa-fw fa-trash" />
            </button>
          </div>
        </div>
        {!isCollapsed && (
          <div className="query-editor-row__body gf-form-query">
            <QueryEditorRows
              queries={value.targets}
              datasource={null}
              onChangeQueries={(queries: DataQuery[]) => {
                console.log('CHANGE', queries);
              }}
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
