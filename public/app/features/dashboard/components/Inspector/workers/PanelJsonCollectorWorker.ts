import { BaseWorker } from './BaseWorker';
import { CollectorItem } from '../types';
import { CollectorOptions, CollectorType } from '../InspectCollector';

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
