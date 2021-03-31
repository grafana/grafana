import { BaseWorker } from './BaseWorker';
import { CollectorItem } from '../types';
import * as Bowser from 'bowser';
import { CollectorOptions, CollectorType } from '../InspectCollector';

export class BrowserCollectorWorker extends BaseWorker {
  canCollect(type: CollectorType): boolean {
    return true;
  }

  async collect(options: CollectorOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => Bowser.getParser(window.navigator.userAgent).getBrowser());
  }
}
