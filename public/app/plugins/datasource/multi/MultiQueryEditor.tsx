// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelData, Button } from '@grafana/ui';
import { MultiResolutionQuery, ResolutionSelection, QueriesForResolution } from './types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { SelectableValue } from '@grafana/data';
import { MultiQueryRow } from './MultiQueryRow';
import { getMultiResolutionQuery } from './MultiDataSource';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  data: PanelData;
  onScrollBottom: () => void;
  onChange: (query: MultiResolutionQuery) => void;
}

type State = {};

export class MultiQueryEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  getQuery(): MultiResolutionQuery {
    const { panel } = this.props;
    return getMultiResolutionQuery(panel.targets);
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
    // const isInterval = query.select === ResolutionSelection.interval;

    return (
      <div>
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
