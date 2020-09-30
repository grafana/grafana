import { PanelData } from '@grafana/data';
import { GridPos } from 'app/features/dashboard/state/PanelModel';
import { ComponentType } from 'react';
import { Observable } from 'rxjs';

export interface Scene {
  title: string;
  panels: Observable<SceneItemList>;
}

export type SceneItemList = Array<Observable<SceneItem>>;

export type SceneItem = VizPanel | ScenePanel | ComponentPanel;

export interface GridElement {
  id: string;
  gridPos: GridPos;
}

export interface ScenePanel extends GridElement, Scene {
  type: 'scene';
}

export interface VizPanel extends GridElement {
  type: 'viz';
  id: string;
  vizId: string;
  title: string;
  data: Observable<PanelData>;
}

export interface ComponentPanel extends GridElement {
  type: 'component';
  id: string;
  gridPos: GridPos;
  component: ComponentType;
}
