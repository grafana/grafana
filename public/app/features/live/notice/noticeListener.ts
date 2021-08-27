import { getGrafanaLiveSrv } from '@grafana/runtime';
import { appEvents, contextSrv } from 'app/core/core';
import {
  AppEvents,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  LiveChannelEvent,
  LiveChannelScope,
} from '@grafana/data';
import { CoreGrafanaLiveFeature } from '../scopes';
import { Subscription } from 'rxjs';
import { LiveNotices } from './types';

class NoticeListener {
  subscription?: Subscription;

  init() {
    const { orgRole } = contextSrv.user;
    if (!orgRole) {
      return; // weird state -- just ignore
    }
    const channel = {
      scope: LiveChannelScope.Grafana,
      namespace: 'notice',
      path: `system/${orgRole}`,
    };

    // TODO: use REST when live is disabled/fails

    const live = getGrafanaLiveSrv();
    if (!live) {
      return;
    }

    this.subscription = live.getStream<LiveNotices>(channel).subscribe({
      next: (event: LiveChannelEvent<LiveNotices>) => {
        // Send the editing state when connection starts
        if (isLiveChannelStatusEvent(event)) {
          this.handleMessage(event.message); // connection message
        }

        if (isLiveChannelMessageEvent(event)) {
          this.handleMessage(event.message);
        }
      },
    });
  }

  handleMessage = (msg: LiveNotices) => {
    if (msg?.notice) {
      for (const notice of msg.notice) {
        console.log('TODO??', notice);
        appEvents.emit(AppEvents.alertWarning, ['Got Notice', JSON.stringify(notice)]);
      }
    }
  };
}

export const noticeListener = new NoticeListener();

export function getNoticeChannelsFeature(): CoreGrafanaLiveFeature {
  setTimeout(() => {
    if (!noticeListener.subscription) {
      noticeListener.init();
    }
  }, 1000);

  return {
    name: 'notice',
    support: {
      getChannelConfig: (path: string) => ({
        description: 'Notice change events',
        hasPresence: true,
        canPublish: true, // admins can post
      }),
    },
    description: 'Notice listener',
  };
}
