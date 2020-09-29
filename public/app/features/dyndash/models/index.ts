import { PanelData } from '@grafana/data';
import { GridPos } from 'app/features/dashboard/state/PanelModel';
import { ComponentType } from 'react';
import { Observable } from 'rxjs';

export interface Scene {
  title: string;
  panels: Observable<ScenePanel[]>;
}

export type ScenePanel = VizPanel | NestedScene | ComponentPanel;

export interface GridElement {
  id: string;
  gridPos: GridPos;
}

export interface NestedScene extends GridElement {
  type: 'scene';
  title: string;
  panels: Observable<ScenePanel[]>;
}

export interface VizPanel extends GridElement {
  id: string;
  type: 'viz';
  vizId: string;
  title: string;
  data: Observable<PanelData>;
}

export interface ComponentPanel extends GridElement {
  id: string;
  type: 'component';
  gridPos: GridPos;
  component: ComponentType;
}
