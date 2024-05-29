import React from 'react';

import { Scope } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { ScopesFiltersAdvancedSelectorScene } from './ScopesFiltersAdvancedSelectorScene';
import { ScopesFiltersBasicSelectorScene } from './ScopesFiltersBasicSelectorScene';
import { ScopesFiltersOpenAdvanced, ScopesFiltersSaveAdvanced } from './events';

export interface ScopesFiltersSceneState extends SceneObjectState {
  basicSelector: ScopesFiltersBasicSelectorScene;
  advancedSelector: ScopesFiltersAdvancedSelectorScene;
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> {
  static Component = ScopesFiltersSceneRenderer;

  constructor() {
    super({
      basicSelector: new ScopesFiltersBasicSelectorScene(),
      advancedSelector: new ScopesFiltersAdvancedSelectorScene(),
    });

    this.addActivationHandler(() => {
      this.state.basicSelector.fetchBaseNodes();

      this.subscribeToEvent(ScopesFiltersOpenAdvanced, ({ payload }) => {
        this.state.advancedSelector.setState(payload);
        this.state.advancedSelector.open();
      });

      this.subscribeToEvent(ScopesFiltersSaveAdvanced, ({ payload }) => {
        this.state.basicSelector.setState(payload);
      });
    });
  }

  public getSelectedScopes(): Scope[] {
    return this.state.basicSelector.state.scopes;
  }

  public enterViewMode() {
    this.state.basicSelector.close();
    this.state.advancedSelector.close();
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const { basicSelector, advancedSelector } = model.useState();

  return (
    <>
      <basicSelector.Component model={basicSelector} />
      <advancedSelector.Component model={advancedSelector} />
    </>
  );
}
