import { type ComponentType, type ReactNode } from 'react';

import { type IconName } from '@grafana/data';

export interface SectionSidebarContext {
  sectionId: string;
  /** Data the current page hands to the section, e.g. `{ folderUid, dashboardUid }` */
  pageContext: Record<string, unknown>;
}

export interface SectionSidebarAction {
  id: string;
  label: string;
  icon?: IconName;
  url?: string;
  onClick?: () => void;
}

export interface SectionSidebarNewActions {
  actions: SectionSidebarAction[];
  /** UI the actions open, e.g. a drawer, rendered alongside the sidebar */
  element?: ReactNode;
}

export interface SectionSidebarItemModel {
  id: string;
  title: string;
  url?: string;
  icon?: IconName;
  subtitle?: string;
}

export interface SectionSidebarSearchResults {
  items: SectionSidebarItemModel[];
  loading: boolean;
  error?: unknown;
}

export interface SectionSidebarFiltersProps<F> {
  value: F;
  onChange: (value: F) => void;
  context: SectionSidebarContext;
}

export interface SectionSidebarSearchConfig<F = unknown> {
  placeholder: string;
  initialFilters?: F;
  /** Called with the debounced query, so implementations can fetch directly */
  useResults: (args: {
    query: string;
    filters: F | undefined;
    context: SectionSidebarContext;
  }) => SectionSidebarSearchResults;
  /** Richer, section specific filtering rendered under the search input */
  Filters?: ComponentType<SectionSidebarFiltersProps<F>>;
  /** Search is active while the query is non-empty; sections with filters can widen that */
  hasActiveFilters?: (filters: F | undefined) => boolean;
}

export interface SectionSidebarGroupProvider {
  /** Stable id, so users can later hide or reorder groups */
  id: string;
  title: string;
  /** A provider can render any number of visual groups, e.g. one per starred folder */
  Component: ComponentType<SectionSidebarContext>;
  /** Separates this group from the ones after it */
  dividerAfter?: boolean;
}

/**
 * Describes a section sidebar. Kept free of core-only types so app plugins can
 * provide definitions for their own sections later on.
 */
export interface SectionSidebarDefinition {
  id: string;
  title: string;
  icon?: IconName;
  /** `sectionNav.main.id` values that show this sidebar automatically */
  navIds: string[];
  headerActions?: Array<SectionSidebarAction & { icon: IconName }>;
  /** One action renders a button, several render a dropdown, none renders nothing */
  useNewActions?: (context: SectionSidebarContext) => SectionSidebarNewActions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search?: SectionSidebarSearchConfig<any>;
  groups: SectionSidebarGroupProvider[];
}

export interface SectionSidebarOverride {
  /** Show this section even though the page nav doesn't match its `navIds` */
  sectionId?: string;
  /** Hide the sidebar on a page that would otherwise match */
  disabled?: boolean;
  context?: Record<string, unknown>;
}
