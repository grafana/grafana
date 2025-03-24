import { ChangeEvent } from 'react';

import { BusEventBase } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { ByFrameRepeater } from './ByFrameRepeater';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { SearchInput } from './SearchInput';

export class BreakdownSearchReset extends BusEventBase {
  public static type = 'breakdown-search-reset';
}

export interface BreakdownSearchSceneState extends SceneObjectState {
  filter?: string;
}

const recentFilters: Record<string, string> = {};

export class BreakdownSearchScene extends SceneObjectBase<BreakdownSearchSceneState> {
  private cacheKey: string;

  constructor(cacheKey: string) {
    super({
      filter: recentFilters[cacheKey] ?? '',
    });
    this.cacheKey = cacheKey;
  }

  public static Component = ({ model }: SceneComponentProps<BreakdownSearchScene>) => {
    const { filter } = model.useState();
    return (
      <SearchInput
        value={filter}
        onChange={model.onValueFilterChange}
        onClear={model.clearValueFilter}
        placeholder={t('trails.breakdown-search-scene.placeholder-search-for-value', 'Search for value')}
      />
    );
  };

  public onValueFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ filter: event.target.value });
    this.filterValues(event.target.value);
  };

  public clearValueFilter = () => {
    this.setState({ filter: '' });
    this.filterValues('');
  };

  public reset = () => {
    this.setState({ filter: '' });
    recentFilters[this.cacheKey] = '';
  };

  private filterValues(filter: string) {
    if (this.parent instanceof LabelBreakdownScene) {
      recentFilters[this.cacheKey] = filter;
      const body = this.parent.state.body;
      body?.forEachChild((child) => {
        if (child instanceof ByFrameRepeater && child.state.body.isActive) {
          child.filterByString(filter);
        }
      });
    }
  }
}
