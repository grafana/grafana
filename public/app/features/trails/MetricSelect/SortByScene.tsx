import { BusEventBase, DataFrame, FieldReducerInfo, ReducerID, SelectableValue, fieldReducers } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { InlineField, Select } from '@grafana/ui';

import { getLabelValueFromDataFrame } from '../services/levels';


export interface SortBySceneState extends SceneObjectState {
  target: 'fields' | 'labels';
  sortBy: string;
  direction: string;
}

export class SortCriteriaChanged extends BusEventBase {
  constructor(
    public target: 'fields' | 'labels',
    public sortBy: string,
    public direction: string
  ) {
    super();
  }
  public static type = 'sort-criteria-changed';
}

export class SortByScene extends SceneObjectBase<SortBySceneState> {
  public sortingOptions = [
    {
      label: '',
      options: [
        {
          value: 'changepoint',
          label: 'Most relevant',
          description: 'Smart ordering of graphs based on the most significant spikes in the data',
        },
        {
          value: ReducerID.stdDev,
          label: 'Widest spread',
          description: 'Sort graphs by deviation from the average value',
        },
        {
          value: 'alphabetical',
          label: 'Name',
          description: 'Alphabetical order',
        },
        {
          value: ReducerID.max,
          label: 'Highest spike',
          description: 'Sort graphs by the highest values (max)',
        },
        {
          value: ReducerID.min,
          label: 'Lowest dip',
          description: 'Sort graphs by the smallest values (min)',
        },
      ],
    },
    {
      label: 'Percentiles',
      options: [...fieldReducers.selectOptions([], filterReducerOptions).options],
    },
  ];

  constructor(state: Pick<SortBySceneState, 'target'>) {
    // FIXME read those from url or localstorage
    // const { sortBy, direction } = getSortByPreference(state.target, 'changepoint', 'desc');
    super({
      target: state.target,
      sortBy: 'changepoint',
      direction: 'desc',
    });
  }

  public onCriteriaChange = (criteria: SelectableValue<string>) => {
    if (!criteria.value) {
      return;
    }
    this.setState({ sortBy: criteria.value });
    // FIXME setSortByPreference(this.state.target, criteria.value, this.state.direction);
    this.publishEvent(new SortCriteriaChanged(this.state.target, criteria.value, this.state.direction), true);
  };

  public onDirectionChange = (direction: SelectableValue<string>) => {
    if (!direction.value) {
      return;
    }
    this.setState({ direction: direction.value });
    // FIXME setSortByPreference(this.state.target, this.state.sortBy, direction.value);
    this.publishEvent(new SortCriteriaChanged(this.state.target, this.state.sortBy, direction.value), true);
  };

  public static Component = ({ model }: SceneComponentProps<SortByScene>) => {
    const { sortBy, direction } = model.useState();
    const group = model.sortingOptions.find((group) => group.options.find((option) => option.value === sortBy));
    const value = group?.options.find((option) => option.value === sortBy);
    return (
      <>
        <InlineField>
          <Select
            onChange={model.onDirectionChange}
            aria-label="Sort direction"
            placeholder=""
            value={direction}
            options={[
              {
                label: 'Asc',
                value: 'asc',
              },
              {
                label: 'Desc',
                value: 'desc',
              },
            ]}
          ></Select>
        </InlineField>
        <InlineField
          label="Sort by"
          htmlFor="sort-by-criteria"
          tooltip="Calculate a derived quantity from the values in your time series and sort by this criteria. Defaults to standard deviation."
        >
          <Select
            value={value}
            width={20}
            isSearchable={true}
            options={model.sortingOptions}
            placeholder={'Choose criteria'}
            onChange={model.onCriteriaChange}
            inputId="sort-by-criteria"
          />
        </InlineField>
      </>
    );
  };
}

const ENABLED_PERCENTILES = ['p10', 'p25', 'p75', 'p90', 'p99'];

function filterReducerOptions(ext: FieldReducerInfo) {
  if (ext.id >= 'p1' && ext.id <= 'p99') {
    return ENABLED_PERCENTILES.includes(ext.id);
  }
  return false;
}

export function getLabelValue(frame: DataFrame) {
  return getLabelValueFromDataFrame(frame) ?? 'No labels';
}
