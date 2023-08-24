import { GridPos } from '@grafana/schema';

import { PluginsAPIPanelModel } from './types';

export class PluginsAPIPanelModelWrapper implements PluginsAPIPanelModel {
  #panel: PluginsAPIPanelModel;

  constructor(panel: PluginsAPIPanelModel) {
    this.#panel = panel;
  }

  get id() {
    return this.#panel.id;
  }
  get title() {
    return this.#panel.title || '';
  }
  get type() {
    return this.#panel.type;
  }
  get gridPos() {
    return this.#panel.gridPos;
  }
  get options() {
    return this.#panel.options;
  }

  set id(id: number) {
    this.#panel.id = id;
  }

  set title(title: string) {
    this.#panel.title = title;
  }

  set type(_) {
    throw new Error('Cannot set type on a panel');
  }

  set gridPos(gridPos: GridPos) {
    this.#panel.gridPos = gridPos;
  }

  set options(options: unknown) {
    this.#panel.options = options;
  }

  refresh() {
    this.#panel.refresh();
  }
}
