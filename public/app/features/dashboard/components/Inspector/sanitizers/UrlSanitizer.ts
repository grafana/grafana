import { CollectorItem, CollectorWorkers, Sanitizer } from '../types';

export class UrlSanitizer implements Sanitizer {
  constructor(readonly id: string) {}

  canSanitize(item: CollectorItem): boolean {
    switch (item.id) {
      case CollectorWorkers.panelData:
      case CollectorWorkers.panelJson:
      case CollectorWorkers.dashboard:
        return true;

      default:
        return false;
    }
  }

  sanitize(item: CollectorItem): Record<string, any> {
    return {};
  }
}
