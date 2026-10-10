import { type DataSourceRef, getDataSourceRef } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

interface DatasourceHolder {
  datasource?: DataSourceRef | string | null;
}

interface LegacyPanel extends DatasourceHolder {
  targets?: DatasourceHolder[];
  panels?: LegacyPanel[];
}

interface LegacyDashboard {
  schemaVersion?: number;
  panels?: LegacyPanel[];
  templating?: { list?: DatasourceHolder[] };
  annotations?: { list?: DatasourceHolder[] };
}

/**
 * v1 dashboards can reference a datasource by a bare name. The v2 save model needs its uid and type, and
 * scene serialization is synchronous, so names are resolved to refs in place before the scene is built.
 * Panels and targets below schemaVersion 33, and annotations below 36, are skipped because DashboardMigrator
 * converts those itself.
 */
export async function resolveLegacyDatasourceNames(dashboard: LegacyDashboard): Promise<void> {
  const schemaVersion = dashboard.schemaVersion ?? 0;
  const holders: DatasourceHolder[] = [...(dashboard.templating?.list ?? [])];

  if (schemaVersion >= 36) {
    holders.push(...(dashboard.annotations?.list ?? []));
  }

  if (schemaVersion >= 33) {
    const collectPanels = (panels: LegacyPanel[]) => {
      for (const panel of panels) {
        holders.push(panel, ...(panel.targets ?? []));
        collectPanels(panel.panels ?? []);
      }
    };
    collectPanels(dashboard.panels ?? []);
  }

  await Promise.all(
    holders.map(async (holder) => {
      const name = holder.datasource;
      if (typeof name !== 'string' || name.startsWith('$')) {
        return;
      }

      const settings = await getDataSourceInstanceSettings(name);
      if (settings) {
        holder.datasource = getDataSourceRef(settings);
      }
    })
  );
}
