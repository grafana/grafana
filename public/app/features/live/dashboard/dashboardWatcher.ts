import { getGrafanaLiveSrv, getLegacyAngularInjector } from '@grafana/runtime';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { appEvents } from 'app/core/core';
import {
  AppEvents,
  LiveChannel,
  LiveChannelScope,
  LiveChannelEvent,
  LiveChannelConfig,
  LiveChannelConnectionState,
  isLiveChannelStatusEvent,
  isLiveChannelMessageEvent,
} from '@grafana/data';
import { CoreEvents } from 'app/types';
import { DashboardChangedModal } from './DashboardChangedModal';
import { DashboardEvent, DashboardEventAction } from './types';
import { CoreGrafanaLiveFeature } from '../scopes';
import { sessionId } from '../live';

class DashboardWatcher {
  channel?: LiveChannel<DashboardEvent>;

  uid?: string;
  ignoreSave?: boolean;
  editing = false;
  lastEditing?: DashboardEvent;

  setEditingState(state: boolean) {
    const changed = (this.editing = state);
    this.editing = state;

    if (changed) {
      this.sendEditingState();
    }
  }

  private sendEditingState() {
    if (!this.channel?.publish) {
      return;
    }

    const msg: DashboardEvent = {
      sessionId,
      uid: this.uid!,
      action: this.editing ? DashboardEventAction.EditingStarted : DashboardEventAction.EditingCanceled,
      message: (window as any).grafanaBootData?.user?.name,
      timestamp: Date.now(),
    };
    this.channel!.publish!(msg);
  }

  watch(uid: string) {
    const live = getGrafanaLiveSrv();
    if (!live) {
      return;
    }

    // Check for changes
    if (uid !== this.uid) {
      this.leave();
      this.channel = live.getChannel({
        scope: LiveChannelScope.Grafana,
        namespace: 'dashboard',
        path: uid,
      });
      this.channel.getStream().subscribe(this.observer);
      this.uid = uid;
    }

    console.log('Watch', uid);
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

  getRecentEditingEvent() {
    if (this.lastEditing && this.lastEditing.timestamp) {
      const elapsed = Date.now() - this.lastEditing.timestamp;
      if (elapsed > 5000) {
        this.lastEditing = undefined;
      }
    }
    return this.lastEditing;
  }

  observer = {
    next: (event: LiveChannelEvent<DashboardEvent>) => {
      // Send the editing state when connection starts
      if (isLiveChannelStatusEvent(event) && this.editing && event.state === LiveChannelConnectionState.Connected) {
        this.sendEditingState();
      }

      if (isLiveChannelMessageEvent(event)) {
        if (event.message.sessionId === sessionId) {
          return; // skip internal messages
        }

        const { action } = event.message;
        switch (action) {
          case DashboardEventAction.EditingStarted:
          case DashboardEventAction.Saved: {
            if (this.ignoreSave) {
              this.ignoreSave = false;
              return;
            }

            const dash = getDashboardSrv().getCurrent();
            if (dash.uid !== event.message.uid) {
              console.log('dashboard event for different dashboard?', event, dash);
              return;
            }

            const changeTracker = getLegacyAngularInjector().get<any>('unsavedChangesSrv').tracker;
            const showPopup = this.editing || changeTracker.hasChanges();

            if (action === DashboardEventAction.Saved) {
              if (showPopup) {
                appEvents.emit(CoreEvents.showModalReact, {
                  component: DashboardChangedModal,
                  props: { event },
                });
              } else {
                appEvents.emit(AppEvents.alertSuccess, ['Dashboard updated']);
                this.reloadPage();
              }
            } else if (showPopup) {
              if (action === DashboardEventAction.EditingStarted) {
                const editingEvent = event.message;
                const recent = this.getRecentEditingEvent();
                if (!recent || recent.message !== editingEvent.message) {
                  appEvents.emit(AppEvents.alertWarning, [
                    'Another session is editing this dashboard',
                    editingEvent.message,
                  ]);
                }
                this.lastEditing = editingEvent;
              }
            }
            return;
          }
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
    hasPresence: true,
    canPublish: () => true,
  };

  return {
    name: 'dashboard',
    support: {
      getChannelConfig: (path: string) => {
        return {
          ...dashboardConfig,
          path, // set the real path
        };
      },
      getSupportedPaths: () => [dashboardConfig],
    },
    description: 'Dashboard listener',
  };
}
