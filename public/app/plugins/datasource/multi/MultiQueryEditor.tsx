// Libraries
import React, { PureComponent } from 'react';
import cloneDeep from 'lodash/cloneDeep';

// Types
import { PanelData, DataSourceSelectItem } from '@grafana/ui';
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
  mixed: DataSourceSelectItem;
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

  onChange = (value: QueriesForResolution) => {
    const query = this.getQuery();
    let found = false;
    query.resolutions = query.resolutions.map(v => {
      if (v === value) {
        found = true;
      } else if (value.ms === v.ms) {
        found = true;
        return value;
      }
      return v;
    });
    if (found) {
      this.props.onChange(query);
    } else {
      console.log('NOT FOUND', value);
    }
  };

  onDelete = (index: number) => {
    const query = this.getQuery();
    query.resolutions.splice(index, 1); // remove one
    this.props.onChange(query);
  };

  onDuplicate = (value: QueriesForResolution) => {
    const query = this.getQuery();
    const add = cloneDeep(value);
    let index = -1;
    for (let i = 0; i < query.resolutions.length; i++) {
      if (value.ms === query.resolutions[i].ms) {
        index = i;
        break;
      }
    }

    if (index < 0 || index >= query.resolutions.length - 1) {
      add.ms = value.ms + 10000;
      this.props.onChange({
        ...query,
        resolutions: [...query.resolutions, add],
      });
    } else {
      const next = query.resolutions[index + 1];
      add.ms = add.ms + (next.ms - add.ms) / 2;
      query.resolutions.splice(index, 0, add);
      this.props.onChange(query);
    }
    console.log('DUPLICATE', add);
  };

  render() {
    const props = this.props;
    const query = this.getQuery();
    // const isInterval = query.select === ResolutionSelection.interval;

    return (
      <div>
        <div>
          {query.resolutions.map((value, index) => {
            const onDelete =
              query.resolutions.length > 1
                ? () => {
                    this.onDelete(index);
                  }
                : undefined;
            return (
              <MultiQueryRow
                key={index}
                panel={props.panel}
                dashboard={props.dashboard}
                data={props.data}
                mixed={props.mixed}
                value={value}
                onScrollBottom={props.onScrollBottom}
                onChange={this.onChange}
                onDuplicate={this.onDuplicate}
                onDelete={onDelete}
              />
            );
          })}
        </div>
        <br />
      </div>
    );
  }
}
