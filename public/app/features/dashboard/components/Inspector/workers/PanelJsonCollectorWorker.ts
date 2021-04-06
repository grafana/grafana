import { BaseWorker } from './BaseWorker';
import { CollectOptions, CollectorItem, CollectorType } from '../types';

export class PanelJsonCollectorWorker extends BaseWorker {
  canCollect({ type, panel }: CollectOptions): boolean {
    return type === CollectorType.Panel && Boolean(panel);
  }

  async collect(options: CollectOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => {
      const { panel } = options;
      return panel!.getSaveModel();
    });
  }
}
