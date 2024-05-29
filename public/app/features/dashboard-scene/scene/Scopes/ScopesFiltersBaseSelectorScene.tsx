import { sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';
import { fetchScope } from './api/scopes';

export interface ScopesFiltersBaseSelectorSceneState extends SceneObjectState {
  isOpened: boolean;
  scopeNames: string[];
}

export abstract class ScopesFiltersBaseSelectorScene extends SceneObjectBase<ScopesFiltersBaseSelectorSceneState> {
  public get filtersParent(): ScopesFiltersScene {
    return sceneGraph.getAncestor(this, ScopesFiltersScene);
  }

  constructor(state: Partial<ScopesFiltersBaseSelectorSceneState> = {}) {
    super({
      isOpened: false,
      scopeNames: [],
      ...state,
    });

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.save = this.save.bind(this);
    this.toggleNodeSelect = this.toggleNodeSelect.bind(this);
  }

  public open() {
    if (!sceneGraph.getAncestor(this, ScopesScene).state.isViewing) {
      this.setState({
        isOpened: true,
        scopeNames: this.filtersParent.state.scopes.map(({ metadata: { name } }) => name),
      });
    }
  }

  public close() {
    this.setState({ isOpened: false });
  }

  public save() {
    this.setState({ isOpened: false });

    this.filtersParent.updateScopes(this.state.scopeNames);
  }

  public toggleNodeSelect(path: string[]) {
    let scopeNames = [...this.state.scopeNames];

    let siblings = this.filtersParent.state.nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      siblings = siblings[path[idx]].nodes;
    }

    const nodeId = path[path.length - 1];
    const {
      item: { linkId },
    } = siblings[nodeId];

    const selectedIdx = scopeNames.findIndex((scopeName) => scopeName === linkId);

    if (selectedIdx === -1) {
      fetchScope(linkId!);

      const selectedFromSameNode =
        scopeNames.length === 0 || Object.values(siblings).some((node) => node.item.linkId === scopeNames[0]);

      scopeNames = !selectedFromSameNode ? [linkId!] : [...scopeNames, linkId!];

      this.setState({ scopeNames });
    } else {
      scopeNames.splice(selectedIdx, 1);

      this.setState({ scopeNames });
    }
  }
}
