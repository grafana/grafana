import { SceneObjectState } from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';

export interface InspectTabState extends SceneObjectState {
  label: string;
  value: InspectTab;
}
