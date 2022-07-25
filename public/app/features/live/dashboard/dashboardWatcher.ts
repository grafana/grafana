import { Unsubscribable } from 'rxjs';

import {
  AppEvents,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  LiveChannelAddress,
  LiveChannelConnectionState,
  LiveChannelEvent,
  LiveChannelScope,
} from '@grafana/data';
import { getGrafanaLiveSrv, locationService } from '@grafana/runtime';
import { appEvents, contextSrv } from 'app/core/core';
import { sessionId } from 'app/features/live';

import { ShowModalReactEvent } from '../../../types/events';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';

import { DashboardChangedModal } from './DashboardChangedModal';
import { DashboardEvent, DashboardEventAction } from './types';

class DashboardWatcher {
  channel?: LiveChannelAddress; // path to the channel
  uid?: string;
  ignoreSave?: boolean;
  editing = false;
  lastEditing?: DashboardEvent;
  subscription?: Unsubscribable;
  hasSeenNotice?: boolean;

  setEditingState(state: boolean) {
    const changed = (this.editing = state);
    this.editing = state;
    this.hasSeenNotice = false;

    if (changed && contextSrv.isEditor) {
      this.sendEditingState();
    }
  }

  private sendEditingState() {
    const { channel, uid } = this;
    if (channel && uid) {
      getGrafanaLiveSrv().publish(channel, {
        sessionId,
        uid,
        action: this.editing ? DashboardEventAction.EditingStarted : DashboardEventAction.EditingCanceled,
        timestamp: Date.now(),
      });
    }
  }

  watch(uid: string) {
    const live = getGrafanaLiveSrv();
    if (!live) {
      return;
    }

    // Check for changes
    if (uid !== this.uid) {
      this.channel = {
        scope: LiveChannelScope.Grafana,
        namespace: 'dashboard',
        path: `uid/${uid}`,
      };
      this.leave();
      if (uid) {
        this.subscription = live.getStream<DashboardEvent>(this.channel).subscribe(this.observer);
      }
      this.uid = uid;
    }
  }

  leave() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.subscription = undefined;
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
            if (dash?.uid !== event.message.uid) {
              console.log('dashboard event for different dashboard?', event, dash);
              return;
            }

            const showPopup = this.editing || dash.hasUnsavedChanges();

            if (action === DashboardEventAction.Saved) {
              if (showPopup) {
                appEvents.publish(
                  new ShowModalReactEvent({
                    component: DashboardChangedModal,
                    props: { event },
                  })
                );
              } else {
                appEvents.emit(AppEvents.alertSuccess, ['Dashboard updated']);
                this.reloadPage();
              }
            } else if (showPopup) {
              if (action === DashboardEventAction.EditingStarted && !this.hasSeenNotice) {
                const editingEvent = event.message;
                const recent = this.getRecentEditingEvent();
                if (!recent || recent.message !== editingEvent.message) {
                  this.hasSeenNotice = true;
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
    },
  };

  reloadPage() {
    locationService.reload();
  }
}

export const dashboardWatcher = new DashboardWatcher();
