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

      const openAdvancedSubscription = this.subscribeToEvent(ScopesFiltersOpenAdvanced, ({ payload }) => {
        this.state.advancedSelector.setState(payload);
        this.state.advancedSelector.open();
      });

      const saveAdvancedSubscription = this.subscribeToEvent(ScopesFiltersSaveAdvanced, ({ payload }) => {
        this.state.basicSelector.setState(payload);
      });

      return () => {
        openAdvancedSubscription.unsubscribe();
        saveAdvancedSubscription.unsubscribe();
      };
    });
  }

  public getSelectedScopes(): Scope[] {
    return this.state.basicSelector.state.scopes;
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
