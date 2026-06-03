import { useEffect } from 'react';

import { isLiveChannelMessageEvent, LiveChannelScope } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { useDispatch } from 'app/types/store';

import { notificationsApi } from '../api/notificationsApi';
import type { Notification } from '../api/types';

interface LiveEvent {
  kind: 'created' | 'deleted';
  notification?: Notification;
  uid?: string;
}

export function useNotificationsLive(orgID: number, userUID: string) {
  const dispatch = useDispatch();
  useEffect(() => {
    if (!orgID || !userUID) {
      return;
    }
    const sub = getGrafanaLiveSrv()
      .getStream<LiveEvent>({
        scope: LiveChannelScope.Grafana,
        stream: 'notifications',
        path: `${orgID}/${userUID}`,
      })
      .subscribe({
        next: (event) => {
          if (!isLiveChannelMessageEvent(event)) {
            return;
          }
          dispatch(notificationsApi.util.invalidateTags([{ type: 'Notification', id: 'LIST' }]));
        },
      });
    return () => sub.unsubscribe();
  }, [dispatch, orgID, userUID]);
}
