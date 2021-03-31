import * as Bowser from 'bowser';

import { DashboardModel, PanelModel } from '../../state';
import { DashboardExporter } from '../DashExportModal';

export interface Sanitizer {
  id: string;
  canSanitize: (item: CollectorItem) => boolean;
  sanitize: (item: CollectorItem) => Record<string, any>;
}

export interface CollectorItem {
  id: string;
  name: string;
  data: Record<string, any>;
}

export interface CollectorWorker {
  canCollect: (type: CollectorType) => boolean;
  collect: (options: CollectorOptions) => Promise<CollectorItem>;
}

export function getCollectorWorkers(): CollectorWorker[] {
  return [
    new BrowserCollectorWorker('BrowserCollectorWorker', 'Browser'),
    new OSCollectorWorker('OSCollectorWorker', 'OS'),
    new GrafanaCollectorWorker('GrafanaCollectorWorker', 'Grafana'),
    new DashboardJsonCollectorWorker('DashboardJsonCollectorWorker', 'Dashboard JSON'),
  ];
}

export function getCollectorSanitizers(): Sanitizer[] {
  return [];
}

export enum CollectorType {
  Dashboard = 'dashboard',
  Panel = 'Panel',
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
}

export class BrowserCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return true;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    let data;
    try {
      data = Bowser.getParser(window.navigator.userAgent).getBrowser();
    } catch (e) {
      data = e;
      console.error(e);
    }

    return {
      id: this.id,
      name: this.name,
      data,
    };
  }
}

export class OSCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return true;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    let data;
    try {
      data = Bowser.getParser(window.navigator.userAgent).getOS();
    } catch (e) {
      data = e;
      console.error(e);
    }

    return {
      id: this.id,
      name: this.name,
      data,
    };
  }
}

export class GrafanaCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return true;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    let data;
    try {
      const grafanaBootData: any = (window as any).grafanaBootData;
      data = grafanaBootData?.settings?.buildInfo ?? {};
    } catch (e) {
      data = e;
      console.error(e);
    }

    return {
      id: this.id,
      name: this.name,
      data,
    };
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

  async collect({ dashboard }: CollectorOptions): Promise<CollectorItem> {
    let data;
    try {
      if (dashboard) {
        data = await this.exporter.makeExportable(dashboard);
      }
    } catch (e) {
      data = e;
      console.error(e);
    }

    return {
      id: this.id,
      name: this.name,
      data,
    };
  }
}
