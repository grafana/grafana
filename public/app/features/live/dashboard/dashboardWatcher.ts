import { ChannelHandler, getGrafanaLiveSrv, getLegacyAngularInjector } from '@grafana/runtime';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { Subscription } from 'rxjs';
import { appEvents } from 'app/core/core';
import { AppEvents } from '@grafana/data';
import { CoreEvents } from 'app/types';
import { DashboardChangedModal } from './DashboardChangedModal';
import { DashboardEvent, DashboardEventAction } from './types';

const dashboardChannelHandler: ChannelHandler<DashboardEvent> = {
  onPublish: (v: DashboardEvent) => {
    return v; // Just pass the object along
  },
};

class DashboardWatcher {
  uid?: string;
  sub?: Subscription;
  ignoreSave?: boolean;
  editing = false;

  setEditingState(state: boolean) {
    if (this.editing !== state) {
      console.log('TODO broadcast!');
    }
    this.editing = state;
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
          if (this.editing) {
            appEvents.emit(CoreEvents.showModalReact, {
              component: DashboardChangedModal,
              props: { event },
            });
          } else {
            appEvents.emit(AppEvents.alertSuccess, ['Dashboard updated']);
            this.reloadPage();
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
