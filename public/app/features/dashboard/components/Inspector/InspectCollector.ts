import { DashboardModel, PanelModel } from '../../state';
import { UrlSanitizer } from './sanitizers/UrlSanitizer';
import { CollectorItem, CollectorType, CollectorWorker, CollectorWorkers, Sanitizer } from './types';
import { BrowserCollectorWorker } from './workers/BrowserCollectorWorker';
import { OSCollectorWorker } from './workers/OSCollectorWorker';
import { GrafanaCollectorWorker } from './workers/GrafanaCollectorWorker';
import { DashboardJsonCollectorWorker } from './workers/DashboardJsonCollectorWorker';
import { PanelJsonCollectorWorker } from './workers/PanelJsonCollectorWorker';
import { PanelDataCollectorWorker } from './workers/PanelDataCollectorWorker';
import { VariablesSanitizer } from './sanitizers/VariablesSanitizer';

export function getCollectorWorkers(): CollectorWorker[] {
  return [
    new OSCollectorWorker(CollectorWorkers.os, 'OS'),
    new BrowserCollectorWorker(CollectorWorkers.browser, 'Browser'),
    new GrafanaCollectorWorker(CollectorWorkers.grafana, 'Grafana'),
    new DashboardJsonCollectorWorker(CollectorWorkers.dashboard, 'Dashboard JSON'),
    new PanelJsonCollectorWorker(CollectorWorkers.panelJson, 'Panel JSON'),
    new PanelDataCollectorWorker(CollectorWorkers.panelData, 'Panel Data'),
  ];
}

export function getCollectorSanitizers(): Sanitizer[] {
  return [new VariablesSanitizer(), new UrlSanitizer('UrlSanitizer')];
}

export interface CollectorOptions {
  dashboard: DashboardModel;
  panel?: PanelModel;
  type: CollectorType;
  workers: CollectorWorker[];
  sanitizers: Sanitizer[];
}

export interface Collector {
  collect: (options: CollectorOptions) => Promise<CollectorItem[]>;
}

export class InspectCollector implements Collector {
  async collect(options: CollectorOptions): Promise<CollectorItem[]> {
    const { workers, sanitizers, type, dashboard, panel } = options;
    const items: CollectorItem[] = [];

    for (const worker of workers) {
      if (!worker.canCollect({ type, panel, dashboard })) {
        continue;
      }

      const item = await worker.collect({ type, panel, dashboard });
      for (const sanitizer of sanitizers) {
        if (!sanitizer.canSanitize(item)) {
          continue;
        }

        item.data = sanitizer.sanitize(item);
      }

      items.push(item);
    }

    return items;
  }
}
