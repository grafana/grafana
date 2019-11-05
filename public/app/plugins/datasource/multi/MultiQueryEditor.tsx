// Libraries
import React, { PureComponent } from 'react';
import cloneDeep from 'lodash/cloneDeep';

// Types
import { PanelData, DataSourceSelectItem, SelectableValue } from '@grafana/data';
import { MultiResolutionQuery, ResolutionSelection, QueriesForResolution } from './types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { MultiQueryRow } from './MultiQueryRow';
import { getMultiResolutionQuery, getQueriesForResolution, nextId } from './MultiDataSource';

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
    const res = query.resolutions.map(v => {
      if (value.id === v.id) {
        found = true;
        return value;
      }
      if (!v.id) {
        v.id = nextId();
      }
      return v;
    });
    if (found) {
      res.sort((a, b) => {
        let msA = a.ms;
        let msB = b.ms;

        // Sort 'now' after regular
        if (a.now) {
          msA += 1;
        }
        if (b.now) {
          msB += 1;
        }

        return msA - msB;
      });

      res[0].ms = 0;
      this.props.onChange({
        ...query,
        resolutions: res,
      });
    } else {
      console.log('NOT FOUND', value, 'vs', query);
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
    add.id = nextId();
    add.ms = getQueriesForResolution(query, this.props.panel.getQueryRunner().lastRequest).time;

    this.props.onChange({
      ...query,
      resolutions: [...query.resolutions, add],
    });
  };

  render() {
    const props = this.props;
    const { panel } = this.props;
    const query = getMultiResolutionQuery(panel.targets);
    const info = getQueriesForResolution(query, panel.getQueryRunner().lastRequest);

    return (
      <div>
        <div>
          {query.resolutions.map((value, idx) => {
            const onDelete =
              query.resolutions.length > 1
                ? () => {
                    this.onDelete(idx);
                  }
                : undefined;
            return (
              <MultiQueryRow
                key={idx}
                isCurrent={idx === info.index}
                currentTime={info.time}
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
