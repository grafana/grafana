import { DashboardCursorSync, DashboardLink } from '../../../index.gen';

import { Kind, Referenceable } from './common';
import {
  AnnotationQueryKind,
  GridLayoutKind,
  PanelKind,
  QueryVariableKind,
  TextVariableKind,
  TimeSettingsSpec,
} from './kinds';

// This kind will not be necessary in the future, the k8s envelope will be provided through ScopedResourceClient
// See public/app/features/apiserver/client.ts
export interface DashboardV2 {
  kind: 'Dashboard';
  spec: DashboardSpec;
}

interface DashboardSpec {
  /**
   *  Unique numeric identifier for the dashboard.
   *  `id` is internal to a specific Grafana instance. `uid` should be used to identify a dashboard across Grafana instances.
   *  @default 0
   * */
  id?: number;
  // Title of dashboard.
  title?: string;
  // Description of dashboard.
  description?: string;
  // Configuration of dashboard cursor sync behavior.
  // Accepted values are 0 (sync turned off), 1 (shared crosshair), 2 (shared crosshair and tooltip).
  cursorSync?: DashboardCursorSync;
  liveNow: boolean; // FIXME: it can be undefined, should this be optional?
  preload: boolean;
  editable: boolean;
  links: DashboardLink[];
  tags: string[];
  // EOf dashboard settings

  timeSettings: TimeSettingsSpec;
  variables: Array<QueryVariableKind | TextVariableKind /* | ... */>;
  elements: Referenceable<PanelKind /** | ... more element types in the future? */>;
  annotations: AnnotationQueryKind[];
  layout: GridLayoutKind;

  // version: will rely on k8s resource versioning, via metadata.resorceVersion

  // revision?: number; // for plugins only
  // gnetId?: string; // ??? Wat is this used for?
}

export const defaultDashboardSpecV2: Partial<DashboardSpec> = {
  editable: true,
  liveNow: false,
  cursorSync: DashboardCursorSync.Off,
  links: [],
  tags: [],
  elements: {},
  layout: {
    kind: 'GridLayout',
    spec: {
      items: [],
    },
  },
};
