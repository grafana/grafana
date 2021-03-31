import { CollectorData, CollectorItem, CollectorWorker } from '../types';
import { CollectorOptions, CollectorType } from '../InspectCollector';

export abstract class BaseWorker implements CollectorWorker {
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
