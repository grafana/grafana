import { BaseWorker } from './BaseWorker';
import { CollectOptions, CollectorItem } from '../types';

export class GrafanaCollectorWorker extends BaseWorker {
  canCollect(options: CollectOptions): boolean {
    return true;
  }

  async collect(options: CollectOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => {
      const grafanaBootData: any = (window as any).grafanaBootData;
      return grafanaBootData?.settings?.buildInfo ?? {};
    });
  }
}
