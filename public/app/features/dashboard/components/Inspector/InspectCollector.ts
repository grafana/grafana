import * as Bowser from 'bowser';

import { DashboardModel, PanelModel } from '../../state';
import { DashboardExporter } from '../DashExportModal';
import { CollectorData, CollectorItem, CollectorWorkers, Sanitizer } from './types';

export interface CollectorWorker {
  canCollect: (type: CollectorType) => boolean;
  collect: (options: CollectorOptions) => Promise<CollectorItem>;
}

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
  return [];
}

export enum CollectorType {
  Dashboard = 'dashboard', // when sharing data for a whole dashboard
  Panel = 'panel', // when sharing data for a panel only
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
    const { workers, sanitizers, type } = options;
    const items: CollectorItem[] = [];

    for (const worker of workers) {
      if (!worker.canCollect(type)) {
        continue;
      }

      const item = await worker.collect(options);
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

abstract class BaseWorker implements CollectorWorker {
  constructor(protected readonly id: string, protected readonly name: string) {}

  abstract canCollect(type: CollectorType): boolean;
  abstract collect(options: CollectorOptions): Promise<CollectorItem>;

  protected getDefaultResult(): CollectorItem {
    return {
      id: this.id,
      name: this.name,
      data: {},
    };
  }

  protected async safelyCollect(
    options: CollectorOptions,
    callback: () => Promise<CollectorData>
  ): Promise<CollectorItem> {
    const item = this.getDefaultResult();

    if (!this.canCollect(options.type)) {
      return { ...item, data: { error: 'Calling collect on a worker that can not collect' } };
    }

    let data;
    try {
      data = await callback();
    } catch (e) {
      data = e;
      console.error(e);
    }

    return { ...item, data };
  }
}

export class BrowserCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return true;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => Bowser.getParser(window.navigator.userAgent).getBrowser());
  }
}

export class OSCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return true;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => Bowser.getParser(window.navigator.userAgent).getOS());
  }
}

export class GrafanaCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return true;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => {
      const grafanaBootData: any = (window as any).grafanaBootData;
      return grafanaBootData?.settings?.buildInfo ?? {};
    });
  }
}

export class DashboardJsonCollectorWorker extends BaseWorker {
  private readonly exporter: DashboardExporter;

  constructor(protected readonly id: string, protected readonly name: string) {
    super(id, name);
    this.exporter = new DashboardExporter();
  }

  canCollect(type: CollectorType): boolean {
    return true;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => {
      const { dashboard } = options;
      if (dashboard) {
        return await this.exporter.makeExportable(dashboard);
      }

      return { error: 'Missing dashboard' };
    });
  }
}

export class PanelJsonCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return type === CollectorType.Panel;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => {
      const { panel } = options;
      if (panel) {
        return panel.getSaveModel();
      }

      return { error: 'Missing panel' };
    });
  }
}

export class PanelDataCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return type === CollectorType.Panel;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => {
      const { panel } = options;
      if (panel) {
        return panel.getQueryRunner().getLastResult() ?? { error: 'Missing lastResult' };
      }

      return { error: 'Missing panel' };
    });
  }
}
