// Libraries
import React, { PureComponent } from 'react';
import defaults from 'lodash/defaults';

// Types
import { PanelData, Button, Select, DataQuery } from '@grafana/ui';
import { MultiResolutionQuery, ResolutionSelection, QueriesForResolution } from './types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { SelectableValue } from '@grafana/data';
import { QueryEditorRows } from 'app/features/dashboard/panel_editor/QueryEditorRows';
import { MultiQueryRow } from './MultiQueryRow';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  data: PanelData;
  onScrollBottom: () => void;
  onChange: (query: MultiResolutionQuery) => void;
}

type State = {};

const resolutionTypes: Array<SelectableValue<ResolutionSelection>> = [
  { value: ResolutionSelection.interval, label: 'Interval', description: 'Select queries by interval' },
  { value: ResolutionSelection.range, label: 'Range', description: 'Select queries based on range' },
];

export class MultiQueryEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  getQuery(): MultiResolutionQuery {
    const { panel } = this.props;
    return defaults(panel.targets[0] as MultiResolutionQuery, {
      select: ResolutionSelection.range,
      resolutions: [],
    });
  }

  async componentDidMount() {
    this.componentDidUpdate(null);
  }

  async componentDidUpdate(prevProps: Props) {
    const { data } = this.props;

    if (!prevProps || prevProps.data !== data) {
      console.log('DATA Changed', data);
    }
  }

  onSelectResolutionType = (item: SelectableValue<ResolutionSelection>) => {
    const { onChange } = this.props;
    const query = this.getQuery();
    onChange({
      ...query,
      select: item.value!,
    });
  };

  addResolution = () => {
    const query = this.getQuery();
    const resolutions = [
      ...query.resolutions,
      {
        resolution: '10m',
        ms: 10000,
        targets: [],
        datasource: null,
      },
    ];

    this.props.onChange({
      ...query,
      resolutions,
    });
  };

  render() {
    const props = this.props;
    const query = this.getQuery();
    const isInterval = query.select === ResolutionSelection.interval;

    return (
      <div>
        <div className="gf-form">
          <div className="gf-form-inline">Select</div>
          <div className="gf-form-inline">
            <Select
              options={resolutionTypes}
              value={isInterval ? resolutionTypes[0] : resolutionTypes[1]}
              onChange={this.onSelectResolutionType}
            />
          </div>
        </div>
        <div>
          {query.resolutions.map((value, index) => {
            return (
              <MultiQueryRow
                key={index}
                panel={props.panel}
                dashboard={props.dashboard}
                data={props.data}
                value={value}
                onScrollBottom={props.onScrollBottom}
                onChange={(value: QueriesForResolution) => {
                  console.log('XXX', value);
                }}
              />
            );
          })}
        </div>
        <Button variant={'inverse'} onClick={this.addResolution}>
          Add Interval
        </Button>
        <br />
        <br />
      </div>
    );
  }
}
