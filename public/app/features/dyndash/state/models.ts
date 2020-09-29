import { PanelData } from '@grafana/data';
import { GridPos } from 'app/features/dashboard/state/PanelModel';
import { Observable } from 'rxjs';

export interface Scene {
  title: string;
  elements: Observable<SceneElement[]>;
}

export type SceneElement = SceneViz | NestedScene;

export interface NestedScene extends Scene {
  type: 'scene';
}

export interface SceneViz {
  type: 'viz';
  vizId: string;
  title: string;
  data: Observable<PanelData>;
  pos: GridPos;
}
