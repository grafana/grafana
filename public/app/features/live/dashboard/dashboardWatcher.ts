import { ChannelHandler, getGrafanaLiveSrv, getLegacyAngularInjector } from '@grafana/runtime';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { Subscription } from 'rxjs';
import { appEvents } from 'app/core/core';
import { AppEvents } from '@grafana/data';
import { CoreEvents } from 'app/types';
import { DashboardWatcherSettings } from './DashboardWatcherSettings';
import { DashboardWatchSettings } from './types';
import store from 'app/core/store';
import { DashboardEvent, DashboardEventAction, DashboardUpdateMode } from './types';

const dashboardChannelHandler: ChannelHandler<DashboardEvent> = {
  onPublish: (v: DashboardEvent) => {
    return v; // Just pass the object along
  },
};

const LOCAL_STORAGE_KEY = 'grafana.live.dashboard';

class DashboardWatcher {
  uid?: string;
  sub?: Subscription;
  ignoreSave?: boolean;
  settings: DashboardWatchSettings;

  constructor() {
    this.settings = store.getObject(LOCAL_STORAGE_KEY, { updateMode: DashboardUpdateMode.Ask });
  }

  saveSettings(settings: DashboardWatchSettings) {
    store.setObject(LOCAL_STORAGE_KEY, settings);
    this.settings = settings;
  }

  watch(uid: string, editing?: boolean) {
    const live = getGrafanaLiveSrv();
    if (!live) {
      return;
    }

    // Check for changes
    if (uid !== this.uid) {
      this.leave();

      this.sub = live
        .initChannel<DashboardEvent>(`grafana/dashboard/${uid}`, dashboardChannelHandler)
        .subscribe(this.observer);
      this.uid = uid;
    }

    console.log('Watch', uid, editing);
  }

  leave() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
    this.sub = undefined;
    this.uid = undefined;
  }

  ignoreNextSave() {
    this.ignoreSave = true;
  }

  observer = {
    next: (event: DashboardEvent) => {
      if (event.action === DashboardEventAction.Saved) {
        const dash = getDashboardSrv().getCurrent();
        if (dash.uid === event.uid && !this.ignoreSave) {
          switch (this.settings.updateMode) {
            case DashboardUpdateMode.Ignore: {
              console.log('Ignore dashboard update', event);
              break;
            }
            case DashboardUpdateMode.ShowNotice: {
              appEvents.emit(AppEvents.alertSuccess, ['Dashboard updated']);
              break;
            }
            case DashboardUpdateMode.AutoUpdate: {
              appEvents.emit(AppEvents.alertSuccess, ['Dashboard updated']);
              this.reloadPage();
              break;
            }
            case DashboardUpdateMode.Ask:
            default:
              appEvents.emit(CoreEvents.showModalReact, {
                component: DashboardWatcherSettings,
                props: { event },
              });
          }
        }
        this.ignoreSave = false;
      } else {
        console.log('DashboardEvent EVENT', event);
      }
    },
  };

  reloadPage() {
    const $route = getLegacyAngularInjector().get<any>('$route');
    if ($route) {
      $route.reload();
    } else {
      location.reload();
    }
  }
}

export const dashboardWatcher = new DashboardWatcher();
