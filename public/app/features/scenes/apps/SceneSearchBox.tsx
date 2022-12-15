import { debounce } from 'lodash';
import React from 'react';
import { lastValueFrom } from 'rxjs';

import {
  BasicValueMatcherOptions,
  DataFrame,
  DataTransformerConfig,
  DataTransformerID,
  getFrameDisplayName,
  LoadingState,
  MatcherConfig,
  PanelData,
  transformDataFrame,
  ValueMatcherID,
} from '@grafana/data';
import {
  FilterByValueMatch,
  FilterByValueTransformerOptions,
  FilterByValueType,
} from '@grafana/data/src/transformations/transformers/filterByValue';
import { Input } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneDataState, SceneObject, SceneObjectStatePlain } from '../core/types';

export interface SceneSearchBoxState extends SceneObjectStatePlain {
  value: string;
}

export class SceneSearchBox extends SceneObjectBase<SceneSearchBoxState> {
  public onChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({ value: evt.currentTarget.value });
  };

  public static Component = ({ model }: SceneComponentProps<SceneSearchBox>) => {
    const { value } = model.useState();

    return <Input width={25} placeholder="Search..." value={value} onChange={model.onChange} />;
  };
}

export interface SceneSearchFilterDataNodeState extends SceneObjectStatePlain {
  sourceData: SceneObject<SceneDataState>;
  searchBox: SceneObject<SceneSearchBoxState>;
  data?: PanelData;
}

export class SceneSearchFilterDataNode extends SceneObjectBase<SceneSearchFilterDataNodeState> {
  public activate(): void {
    super.activate();

    if (!this.parent || !this.parent.parent) {
      throw new Error('SceneSearchFilterDataNode must be a child of another scene object');
    }

    this.state.sourceData.activate();

    this._subs.add(
      this.state.searchBox.subscribeToState({
        next: (state) => {
          this.queryChanged(state.value);
        },
      })
    );

    this._subs.add(
      this.state.sourceData.subscribeToState({
        next: (data) => {
          if (data.data?.state === LoadingState.Done) {
            this.filterData(data.data, this.state.searchBox.state.value);
          } else {
            this.setState({ data: data.data });
          }
        },
      })
    );
  }

  public deactivate(): void {
    super.deactivate();
    this.state.sourceData.deactivate();
  }

  public queryChanged = debounce((searchQuery: string) => {
    this.filterData(this.state.sourceData.state.data, searchQuery);
  }, 30);

  private async filterData(unfiltered: PanelData | undefined, searchQuery: string) {
    if (!unfiltered) {
      return;
    }

    if (!searchQuery || unfiltered.series.length === 0) {
      this.setState({ data: unfiltered });
      return;
    }

    const data: PanelData = {
      ...unfiltered,
      series: [],
    };

    // handle table filter
    if (unfiltered.series[0].fields.length > 2) {
      data.series = await lastValueFrom(filterByValues(unfiltered.series, searchQuery));
    } else {
      data.series = unfiltered.series.filter((frame) => {
        return getFrameDisplayName(frame).toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    this.setState({ data });
  }
}

function filterByValues(frames: DataFrame[], query: string) {
  const regex: MatcherConfig<BasicValueMatcherOptions<string>> = {
    id: ValueMatcherID.regex,
    options: { value: query },
  };

  const cfg: DataTransformerConfig<FilterByValueTransformerOptions> = {
    id: DataTransformerID.filterByValue,
    options: {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      filters: [
        {
          fieldName: 'handler',
          config: regex,
        },
      ],
    },
  };

  return transformDataFrame([cfg], frames);
}
