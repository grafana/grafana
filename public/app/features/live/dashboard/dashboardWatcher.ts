import { getGrafanaLiveSrv, getLegacyAngularInjector } from '@grafana/runtime';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { appEvents } from 'app/core/core';
import { AppEvents, LiveChannel, LiveChannelScope, LiveChannelEvent, LiveChannelConfig } from '@grafana/data';
import { CoreEvents } from 'app/types';
import { DashboardChangedModal } from './DashboardChangedModal';
import { DashboardEvent, DashboardEventAction } from './types';
import { CoreGrafanaLiveFeature } from '../scopes';

class DashboardWatcher {
  channel?: LiveChannel<DashboardEvent>;

  uid?: string;
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
      this.channel = live.getChannel(LiveChannelScope.Grafana, 'dashboard', uid);
      this.channel.getStream().subscribe(this.observer);
      this.uid = uid;
    }

    console.log('Watch', uid, editing);
  }

  leave() {
    if (this.channel) {
      this.channel.disconnect();
    }
    this.uid = undefined;
  }

  ignoreNextSave() {
    this.ignoreSave = true;
  }

  observer = {
    next: (event: LiveChannelEvent<DashboardEvent>) => {
      if (event.message) {
        if (event.message.action === DashboardEventAction.Saved) {
          if (this.ignoreSave) {
            this.ignoreSave = false;
            return;
          }

          const dash = getDashboardSrv().getCurrent();
          if (dash.uid !== event.message.uid) {
            console.log('dashboard event for differnt dashboard?', event, dash);
            return;
          }
          if (this.editing) {
            appEvents.emit(CoreEvents.showModalReact, {
              component: DashboardChangedModal,
              props: { event },
            });
          } else {
            appEvents.emit(AppEvents.alertSuccess, ['Dashboard updated']);
            this.reloadPage();
          }
          return;
        }
      }
      console.log('DashboardEvent EVENT', event);
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

export function getDashboardChannelsFeature(): CoreGrafanaLiveFeature {
  const dashboardConfig: LiveChannelConfig = {
    path: '${uid}',
    description: 'Dashboard change events',
    variables: [{ value: 'uid', label: '${uid}', description: 'unique id for a dashboard' }],
    hasPresense: true,
  };

  return {
    name: 'dashboard',
    support: {
      getChannelConfig: (path: string) => {
        return {
          path,
          hasPresense: true,
        };
      },
      getSupportedPaths: () => [dashboardConfig],
    },
    description: 'Dashboard listener',
  };
}
