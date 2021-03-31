import { BaseWorker } from './BaseWorker';
import { DashboardExporter } from '../../DashExportModal';
import { CollectorItem } from '../types';
import { CollectorOptions, CollectorType } from '../InspectCollector';

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
