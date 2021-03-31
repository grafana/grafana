import * as Bowser from 'bowser';

import { DashboardModel, PanelModel } from '../../state';

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
  collect: (options: CollectorOptions) => CollectorItem;
}

export function getCollectorWorkers(): CollectorWorker[] {
  return [
    new BrowserCollectorWorker('BrowserCollectorWorker', 'Browser'),
    new OSCollectorWorker('OSCollectorWorker', 'OS'),
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
  collect: (options: CollectorOptions) => CollectorItem[];
}

export class InspectCollector implements Collector {
  collect(options: CollectorOptions): CollectorItem[] {
    const { workers, sanitizers, type } = options;
    const items: CollectorItem[] = [];

    for (const worker of workers) {
      if (!worker.canCollect(type)) {
        continue;
      }

      const item = worker.collect(options);
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
  abstract collect(options: CollectorOptions): CollectorItem;
}

export class BrowserCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return true;
  }

  collect(options: CollectorOptions): CollectorItem {
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

  collect(options: CollectorOptions): CollectorItem {
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
