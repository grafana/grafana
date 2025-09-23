import { store } from '@grafana/data';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { DashboardScene } from '../scene/DashboardScene';
import { EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';

import { DashboardInteractions } from './interactions';

export interface DashboardInitProps {
  [key: string]: unknown;
}

export function trackDashboardSceneLoaded(dashboard: DashboardScene, duration?: number) {
  const trackingInformation = dashboard.getTrackingInformation();
  const v2TrackingFields = {
    tabCount: trackingInformation?.tabCount,
    templateVariableCount: trackingInformation?.templateVariableCount,
    maxNestingLevel: trackingInformation?.maxNestingLevel,
    dashStructure: trackingInformation?.dashStructure,
    conditionalRenderRules: trackingInformation?.conditionalRenderRulesCount,
    autoLayoutCount: trackingInformation?.autoLayoutCount,
    customGridLayoutCount: trackingInformation?.customGridLayoutCount,
  };

  DashboardInteractions.dashboardInitialized({
    theme: undefined,
    duration,
    isScene: true,
    ...v2TrackingFields,
  });
}

export const trackDeleteDashboardElement = (element: EditableDashboardElementInfo) => {
  switch (element?.typeName) {
    case 'Row':
      DashboardInteractions.trackRemoveRowClick();
      break;
    case 'Tab':
      DashboardInteractions.trackRemoveTabClick();
      break;
    default:
      break;
  }
};

export function getNoOfConditionalRulesInDashboard(layout: DashboardV2Spec['layout']): number {
  const l = castLayoutKind(layout);
  switch (l.kind) {
    case 'GridLayout':
      return 0;
    case 'AutoGridLayout':
      return l.spec.items.reduce((acc, item) => {
        const direct = item.spec.conditionalRendering?.spec?.items?.length || 0;
        return acc + direct;
      }, 0);
    case 'RowsLayout':
      return l.spec.rows.reduce((acc, row) => {
        const direct = row.spec.conditionalRendering?.spec?.items?.length || 0;
        const nested = row.spec.layout ? getNoOfConditionalRulesInDashboard(row.spec.layout) : 0;
        return acc + direct + nested;
      }, 0);
    case 'TabsLayout':
      return l.spec.tabs.reduce((acc, row) => {
        const direct = row.spec.conditionalRendering?.spec?.items?.length || 0;
        const nested = row.spec.layout ? getNoOfConditionalRulesInDashboard(row.spec.layout) : 0;
        return acc + direct + nested;
      }, 0);
    default:
      // make sure we handle all possible kinds
      const exhaustiveCheck: never = l;
      throw new Error(`Unhandled layout: ${exhaustiveCheck}`);
  }
}

interface LayoutStats {
  tabCount: number;
  maxDepth: number;
  layoutTypesCount: Record<DashboardV2Spec['layout']['kind'], number>;
}
export function getLayoutStatsForDashboard(layout: DashboardV2Spec['layout']): LayoutStats {
  const layoutTypesCount: Record<DashboardV2Spec['layout']['kind'], number> = {
    AutoGridLayout: 0,
    GridLayout: 0,
    RowsLayout: 0,
    TabsLayout: 0,
  };
  let tabCount = 0;
  let maxDepth = 0;

  const recursivelygetLayoutStats = (layout: DashboardV2Spec['layout'], depth: number) => {
    const l = castLayoutKind(layout);
    if (depth > maxDepth) {
      maxDepth = depth;
    }
    switch (l.kind) {
      case 'GridLayout':
        layoutTypesCount.GridLayout++;
        break;
      case 'AutoGridLayout':
        layoutTypesCount.AutoGridLayout++;
        break;
      case 'RowsLayout':
        layoutTypesCount.RowsLayout++;
        l.spec.rows.forEach((row) => {
          if (row.spec.layout) {
            recursivelygetLayoutStats(row.spec.layout, depth + 1);
          }
        });
        break;
      case 'TabsLayout':
        layoutTypesCount.TabsLayout++;
        tabCount += l.spec.tabs.length;
        l.spec.tabs.forEach((tab) => {
          if (tab.spec.layout) {
            recursivelygetLayoutStats(tab.spec.layout, depth + 1);
          }
        });
        break;
      default:
        break;
    }
  };
  recursivelygetLayoutStats(layout, 0);

  return { layoutTypesCount, tabCount, maxDepth };
}

// type guard for layout kinds
type LayoutType = DashboardV2Spec['layout'];
type ExtractLayout<K extends LayoutType['kind']> = Extract<LayoutType, { kind: K }>;
function castLayoutKind<K extends LayoutType['kind']>(layout: ExtractLayout<K>): ExtractLayout<K> {
  switch (layout.kind) {
    case 'RowsLayout':
    case 'GridLayout':
    case 'AutoGridLayout':
    case 'TabsLayout':
      return layout;
    default:
      throw new Error(`Unknown layout kind: ${layout['kind']}`);
  }
}

// a sanitized version of the layout, showing only the structure (kind and nesting) without any IDs or names
type StructureNode = {
  kind: string;
  children?: StructureNode[];
};

export function getSanitizedLayout(layout: DashboardV2Spec['layout']): string {
  return JSON.stringify(getStructure(layout));
}

function getStructure(layout: DashboardV2Spec['layout']): StructureNode[] {
  const l = castLayoutKind(layout);

  switch (l.kind) {
    case 'TabsLayout':
      return l.spec.tabs.map((tab, i) => ({
        kind: 'tab',
        children: tab.spec.layout ? getStructure(tab.spec.layout) : [],
      }));

    case 'RowsLayout':
      return l.spec.rows.map((row, i) => ({
        kind: 'row',
        children: row.spec.layout ? getStructure(row.spec.layout) : [],
      }));

    case 'GridLayout':
    case 'AutoGridLayout':
      return l.spec.items.map(() => ({
        kind: 'panel',
      }));

    default:
      return [];
  }
}

export const trackDashboardSceneEditButtonClicked = () => {
  const outlineExpandedByDefault = !store.getBool('grafana.dashboard.edit-pane.outline.collapsed', true);
  DashboardInteractions.editButtonClicked({
    outlineExpanded: outlineExpandedByDefault,
  });
};

export interface DashboardCreatedProps {
  name: string;
  url: string;
  [key: string]: unknown;
}

export function trackDashboardSceneCreatedOrSaved(
  name: 'created' | 'saved',
  dashboard: DashboardScene,
  initialProperties: DashboardCreatedProps
) {
  const trackingInformation = dashboard.getTrackingInformation();
  const v2TrackingFields = {
    numPanels: trackingInformation?.panels_count,
    conditionalRenderRules: trackingInformation?.conditionalRenderRulesCount,
    autoLayoutCount: trackingInformation?.autoLayoutCount,
    customGridLayoutCount: trackingInformation?.customGridLayoutCount,
  };

  DashboardInteractions.dashboardCreatedOrSaved(name, {
    ...initialProperties,
    ...v2TrackingFields,
  });
}
