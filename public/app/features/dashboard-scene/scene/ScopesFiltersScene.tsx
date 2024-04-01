import React from 'react';

import { AppEvents, Scope, ScopeBinding, SelectableValue } from '@grafana/data';
import { config, getAppEvents } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Select } from '@grafana/ui';

import { ScopedResourceServer } from '../../apiserver/server';

export interface ScopesFiltersSceneState extends SceneObjectState {
  isLoading: boolean;
  pendingValue: string | undefined;
  scopes: Scope[];
  value: string | undefined;
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> {
  static Component = ScopesFiltersSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scope'] });

  private server = new ScopedResourceServer<ScopeBinding, 'Scope'>({
    group: 'scope.grafana.app',
    version: 'v0alpha1',
    resource: 'scopes',
  });

  constructor() {
    super({
      isLoading: true,
      pendingValue: undefined,
      scopes: [],
      value: undefined,
    });

    if (config.bootData.settings.listScopesEndpoint) {
      this.server.overwriteUrl(config.bootData.settings.listScopesEndpoint);
    }
  }

  getUrlState() {
    return { scope: this.state.value };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const scope = values.scope ?? undefined;
    this.setScope(Array.isArray(scope) ? scope[0] : scope);
  }

  public getSelectedScope(): Scope | undefined {
    return this.state.scopes.find((scope) => scope.name === this.state.value);
  }

  public setScope(newScope: string | undefined) {
    if (this.state.isLoading) {
      return this.setState({ pendingValue: newScope });
    }

    if (!this.state.scopes.find((scope) => scope.name === newScope)) {
      newScope = undefined;
    }

    this.setState({ value: newScope });
  }

  public async fetchScopes() {
    this.setState({ isLoading: true });

    try {
      const response = await this.server.list();

      this.setScopesAfterFetch(
        response.items.map(({ metadata: { name }, spec }) => ({
          name,
          ...spec,
        }))
      );
    } catch (err) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to fetch scopes'],
      });

      this.setScopesAfterFetch([]);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  private setScopesAfterFetch(scopes: Scope[]) {
    let value = this.state.pendingValue ?? this.state.value;

    if (!scopes.find((scope) => scope.name === value)) {
      value = undefined;
    }

    this.setState({ scopes, pendingValue: undefined, value });
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const { scopes, isLoading, value } = model.useState();
  const parentState = model.parent!.useState();
  const isViewing = 'isViewing' in parentState ? !!parentState.isViewing : false;

  const options: Array<SelectableValue<string>> = scopes.map(({ name, title, category }) => ({
    label: title,
    value: name,
    description: category,
  }));

  return (
    <Select
      isClearable
      isLoading={isLoading}
      disabled={isViewing}
      options={options}
      value={value}
      onChange={(selectableValue) => model.setScope(selectableValue?.value ?? undefined)}
    />
  );
}
