import { BaseWorker } from './BaseWorker';
import { CollectOptions, CollectorItem } from '../types';
import * as Bowser from 'bowser';

export class OSCollectorWorker extends BaseWorker {
  canCollect(options: CollectOptions): boolean {
    return true;
  }

  async collect(options: CollectOptions): Promise<CollectorItem> {
    return await this.safelyCollect(options, async () => Bowser.getParser(window.navigator.userAgent).getOS());
  }
}
