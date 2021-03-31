import { DashboardModel, PanelModel } from '../../state';

export interface Sanitizer {
  id: string;
  canSanitize: (item: CollectorItem) => boolean;
  sanitize: (item: CollectorItem) => CollectorItem;
}

export interface CollectorItem {
  id: string;
  name: string;
  data: Record<string, any>;
}

export interface CollectorWorker {
  collect: (options: CollectorOptions) => CollectorItem;
}

export function getCollectorWorkers(): CollectorWorker[] {
  return [];
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
  sanitizers: Sanitizer[];
}

export interface Collector {
  collect: (options: CollectorOptions) => CollectorItem[];
}

export class InspectCollector implements Collector {
  collect(options: CollectorOptions): CollectorItem[] {
    return [];
  }
}
