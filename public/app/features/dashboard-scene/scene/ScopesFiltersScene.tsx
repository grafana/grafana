import React from 'react';

import { Scope, SelectableValue } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Select } from '@grafana/ui';

export interface ScopesFiltersSceneState extends SceneObjectState {
  isLoading: boolean;
  pendingValue: string | undefined;
  scopes: Scope[];
  value: string | undefined;
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> {
  static Component = ScopesFiltersSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scope'] });

  constructor() {
    super({
      isLoading: true,
      pendingValue: undefined,
      scopes: [],
      value: undefined,
    });
  }

  getUrlState() {
    return { scope: this.state.value };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    this.setScope(values.scope as string | undefined);
  }

  public getSelectedScope(): Scope | undefined {
    return this.state.scopes.find((scope) => scope.uid === this.state.value);
  }

  public setScope(newScope: string | undefined) {
    if (this.state.isLoading) {
      return this.setState({ pendingValue: newScope });
    }

    if (!this.state.scopes.find((scope) => scope.uid === newScope)) {
      newScope = undefined;
    }

    this.setState({ value: newScope });
  }

  public async fetchScopes() {
    this.setState({ isLoading: true });

    setTimeout(() => {
      this.setScopesAfterFetch([
        {
          uid: '9842607e-d7aa-4338-8a23-25610e266db8',
          title: 'Scope 1',
          type: 'scope1',
          description: '',
          category: 'Category 1',
          filters: [],
        },
        {
          uid: '27973258-11b8-4ffa-9b4a-c864bf53555f',
          title: 'Scope 2',
          type: 'scope2',
          description: '',
          category: 'Category 2',
          filters: [],
        },
        {
          uid: 'cd69e0a7-166e-414a-a85d-cb91a03ad282',
          title: 'Scope 3',
          type: 'scope3',
          description: '',
          category: 'Category 1',
          filters: [],
        },
        {
          uid: '79216d99-22c8-488c-9f85-227099acf5ae',
          title: 'Scope 4',
          type: 'scope4',
          description: '',
          category: 'Category 3',
          filters: [],
        },
        {
          uid: '11f25259-8234-496e-94ad-d51600787acb',
          title: 'Scope 5',
          type: 'scope5',
          description: '',
          category: 'Category 2',
          filters: [],
        },
        {
          uid: '4afb3b52-5b6b-4c74-b58a-e29095847063',
          title: 'Scope 6',
          type: 'scope6',
          description: '',
          category: 'Category 1',
          filters: [],
        },
      ]);

      this.setState({ isLoading: false });
    }, 500);
  }

  private setScopesAfterFetch(scopes: Scope[]) {
    let value = this.state.pendingValue ?? this.state.value;

    if (!scopes.find((scope) => scope.uid === value)) {
      value = undefined;
    }

    this.setState({ scopes, pendingValue: undefined, value });
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const { scopes, isLoading, value } = model.useState();

  const options: Array<SelectableValue<string>> = scopes.map(({ uid, title, category }) => ({
    label: title,
    value: uid,
    description: category,
  }));

  return (
    <Select
      isClearable
      isLoading={isLoading}
      options={options}
      value={value}
      onChange={(selectableValue) => model.setScope(selectableValue?.value ?? undefined)}
    />
  );
}
