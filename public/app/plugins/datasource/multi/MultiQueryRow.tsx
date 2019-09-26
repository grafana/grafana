// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelData, DataQuery, DataSourceSelectItem } from '@grafana/ui';
import { QueriesForResolution } from './types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { QueryEditorRows } from 'app/features/dashboard/panel_editor/QueryEditorRows';
import kbn from 'app/core/utils/kbn';
import { css } from 'emotion';

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
}

type State = {
  isCollapsed: boolean;
  txt: string;
};

export class MultiQueryRow extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isCollapsed: false,
      txt: '',
    };
  }

  componentDidMount() {
    this.componentDidUpdate(null);
  }

  componentDidUpdate(prevProps: Props) {
    const { value } = this.props;

    if (!prevProps || prevProps.value !== value) {
      this.setState({
        txt: value.txt || '',
      });
    }
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

  onTextChange = (event: any) => {
    // const { value, onChange } = this.props;
    const v = event.target.value;

    // // Update the text
    // onChange({
    //   ...value,
    //   txt: v,
    // });
    this.setState({ txt: v });
    console.log('TXT', v);
  };

  onBlur = () => {
    const { value, onChange } = this.props;
    const { txt } = this.state;

    try {
      const ms = kbn.interval_to_ms(txt);
      if (ms) {
        console.log('SET', ms, txt);
        onChange({
          ...value,
          txt,
          ms,
        });
        return;
      }
    } catch {}

    // Reset the
    this.setState({
      txt: value.txt || '',
    });
  };

  render() {
    const { value, data, dashboard, panel, onScrollBottom, onDelete, mixed } = this.props;
    const { txt, isCollapsed } = this.state;
    const xxx = css({
      fontSize: 16,
      fontWeight: 500,
      padding: '4px',
    });
    return (
      <div className="query-editor-row">
        <div className="query-editor-row__header">
          <div onClick={this.toggleCollapse}>
            {isCollapsed && <i className="fa fa-caret-right" />}
            {!isCollapsed && <i className="fa fa-caret-down" />}
            <span>&nbsp;</span>
          </div>
          <div>
            <input
              type="text"
              className={xxx}
              value={txt}
              onChange={this.onTextChange}
              placeholder="Base"
              onBlur={this.onBlur}
            />
          </div>
          <div className="query-editor-row__collapsed-text" onClick={this.toggleCollapse}>
            <div>{value.ms}ms</div>
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
