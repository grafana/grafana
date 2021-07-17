import { BaseWorker } from './BaseWorker';
import { DashboardExporter } from '../../DashExportModal';
import { CollectOptions, CollectorItem } from '../types';

export class DashboardJsonCollectorWorker extends BaseWorker {
  private readonly exporter: DashboardExporter;

  constructor(protected readonly id: string, protected readonly name: string) {
    super(id, name);
    this.exporter = new DashboardExporter();
  }

  canCollect({ dashboard }: CollectOptions): boolean {
    return Boolean(dashboard);
  }

  async collect(options: CollectOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => {
      const { dashboard } = options;
      return await this.exporter.makeExportable(dashboard);
    });
  }
}
