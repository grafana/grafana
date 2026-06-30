import { useMemo } from 'react';

import { t } from '@grafana/i18n';

import { type HomeWidgetCatalogEntry, type WidgetLayoutItem } from '../types';

import { PanelWidget } from './PanelWidget';

/**
 * Derives catalog entries for pinned dashboard panels from the persisted layout (the dynamic 4th
 * widget source). Each panel item becomes a `source: 'panel'` entry that renders live via PanelWidget.
 */
export function usePanelWidgetEntries(items: WidgetLayoutItem[]): HomeWidgetCatalogEntry[] {
  return useMemo(
    () =>
      items
        .filter((item) => item.panel)
        .map((item): HomeWidgetCatalogEntry => {
          const { dashboardUid, panelId, title } = item.panel!;
          return {
            id: item.id,
            title: title || t('home.widgets.panel.untitled', 'Dashboard panel'),
            description: t('home.widgets.panel.description', 'Pinned from a dashboard'),
            icon: 'apps',
            source: 'panel',
            defaultSize: { w: item.w, h: item.h },
            minSize: { w: 6, h: 4 },
            render: () => <PanelWidget dashboardUid={dashboardUid} panelId={panelId} />,
          };
        }),
    [items]
  );
}
