// Libraries
import React, { PureComponent } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import classNames from 'classnames';

// Types
import { PanelData, DataSourceSelectItem } from '@grafana/ui';
import { MultiResolutionQuery, ResolutionSelection, QueriesForResolution } from './types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { SelectableValue } from '@grafana/data';
import { MultiQueryRow } from './MultiQueryRow';
import { getMultiResolutionQuery, getQueriesForResolution } from './MultiDataSource';

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
    const res = query.resolutions.map(v => {
      if (v === value) {
        found = true;
      } else if (value.ms === v.ms) {
        found = true;
        return value;
      }
      return v;
    });
    if (found) {
      // const res = q.resolutions.map(r => {
      //   // if (r.ms <= 0) {
      //   //   try {
      //   //     const ms = kbn.interval_to_ms(r.txt);
      //   //     if (ms) {
      //   //       r.ms = ms;
      //   //     }
      //   //   } catch {}
      //   // }
      //   return r;
      // });
      res.sort((a, b) => {
        return a.ms - b.ms;
      });
      res[0].ms = Number.NEGATIVE_INFINITY;
      res[0].txt = '';
      this.props.onChange({
        ...query,
        resolutions: res,
      });
    } else {
      console.log('NOT FOUND', value, 'vs');
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
      add.ms = Math.max(value.ms, 1) + 10000;
      this.props.onChange({
        ...query,
        resolutions: [...query.resolutions, add],
      });
    } else {
      const next = query.resolutions[index + 1];
      const cMs = Math.max(value.ms, 1);
      const nMs = Math.max(next.ms, 1);
      add.ms = cMs + (nMs - cMs) / 2;
      query.resolutions.splice(index, 0, add);
      this.props.onChange(query);
    }
    console.log('DUPLICATE', add);
  };

  render() {
    const props = this.props;
    const { panel } = this.props;
    const query = getMultiResolutionQuery(panel.targets);
    const current = getQueriesForResolution(query, panel.getQueryRunner().lastRequest).index;

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
                current={idx === current}
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
