import { BaseWorker } from './BaseWorker';
import { CollectorItem } from '../types';
import { CollectorOptions, CollectorType } from '../InspectCollector';

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
