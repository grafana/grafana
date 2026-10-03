import { AppEvents, type EventBus } from '@grafana/data';

import { getAppEvents } from '../../appEvents';

import { DataSourceCacheSourceDecorator } from './decorator';
import { type BootDataSourceSettings, type DataSourceListSnapshot } from './types';

// Plain strings: @grafana/runtime does not depend on @grafana/i18n.
const TITLE = 'Data sources failed to load';
const TEXT = 'Refresh the page to try again.';

/**
 * Tells the user when the data source list fails to load. Shown once per run of failures, so a
 * retry that fails again does not stack toasts; the next list that loads resets it.
 */
export class LoadFailureNoticeSource extends DataSourceCacheSourceDecorator {
  private notified = false;

  loadList(): Promise<DataSourceListSnapshot> {
    return this.watch(super.loadList());
  }

  refreshList(payload?: BootDataSourceSettings): Promise<DataSourceListSnapshot> {
    return this.watch(super.refreshList(payload));
  }

  private async watch(load: Promise<DataSourceListSnapshot>): Promise<DataSourceListSnapshot> {
    try {
      const snapshot = await load;
      this.notified = false;
      return snapshot;
    } catch (error) {
      this.notify();
      throw error;
    }
  }

  private notify(): void {
    if (this.notified) {
      return;
    }
    this.notified = true;
    try {
      // The app event bus is set at boot; without it there is nobody to show the toast to.
      const events: EventBus | undefined = getAppEvents();
      events?.publish({ type: AppEvents.alertError.name, payload: [TITLE, TEXT] });
    } catch {
      // A failed toast must not turn a load failure into a different failure.
    }
  }
}
