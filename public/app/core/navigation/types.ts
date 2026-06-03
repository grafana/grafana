export const NAV_LAYOUT_VERSION = 1;

export interface NavLayoutConfig {
  version?: number;
  personaId?: string;
  pinnedIds?: string[];
  order?: string[];
  expandedOverflow?: boolean;
}

export interface NavLayoutPreference {
  bookmarkUrls?: string[];
  layout?: NavLayoutConfig;
}

export interface ProjectedNavTree {
  primary: Array<import('@grafana/data').NavModelItem>;
  overflow: Array<import('@grafana/data').NavModelItem>;
  expandedOverflow: boolean;
}
