import { useEffect } from 'react';

import { LiveChannelScope } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { useDispatch } from 'app/types/store';

import { pulseApi } from '../api/pulseApi';
import { type PulseEvent, type ResourceKind } from '../types';

interface Args {
  resourceKind: ResourceKind;
  resourceUID?: string;
  enabled: boolean;
}

/**
 * useResourcePulseStream subscribes to grafana/pulse/<kind>/<uid> via
 * Grafana Live and triggers RTK Query cache invalidations on each
 * event. RTK then refetches affected queries lazily — the live channel
 * itself never carries pulse bodies, only event metadata, so it stays
 * cheap and we don't have to worry about leaking content to subscribers
 * with stale permissions.
 *
 * If Live can't be reached (proxy stripping WebSockets, etc.), the
 * resource-version polling query in PulseDrawer takes over.
 */
export function useResourcePulseStream({ resourceKind, resourceUID, enabled }: Args) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!enabled || !resourceUID) {
      return;
    }
    const live = getGrafanaLiveSrv();
    if (!live) {
      return;
    }
    // Live channel: grafana/pulse/<resourceKind>/<resourceUID>. The
    // `namespace` here is the Live "scope namespace" (literally the
    // string 'pulse'), distinct from the org K8s namespace that the
    // backend prepends server-side.
    const sub = live
      .getStream<PulseEvent>({
        scope: LiveChannelScope.Grafana,
        namespace: 'pulse',
        path: resourceKind,
        stream: resourceUID,
      })
      .subscribe({
        next: (msg) => {
          if (msg.type !== 'message') {
            return;
          }
          const evt = msg.message;
          dispatch(
            pulseApi.util.invalidateTags([
              { type: 'ResourceThreads', id: `${evt.resourceKind}:${evt.resourceUID}` },
              { type: 'ResourceVersion', id: `${evt.resourceKind}:${evt.resourceUID}` },
              // PanelMentions feeds the per-panel title-bar indicator;
              // every event that affects the thread list could also
              // change which panels are mentioned, so bust this tag on
              // the same channel.
              { type: 'PanelMentions', id: `${evt.resourceKind}:${evt.resourceUID}` },
              // Participants feeds the "Users" filter dropdown. Any
              // pulse event can change the unique-author rollup (a new
              // reply from a previously-unseen user, a deleted pulse
              // dropping a user from the list), so we treat it the
              // same as the other resource-scoped tags.
              { type: 'Participants', id: `${evt.resourceKind}:${evt.resourceUID}` },
              { type: 'Thread', id: evt.threadUID },
              { type: 'Pulse', id: evt.threadUID },
            ])
          );
        },
        error: () => {
          // Live errors are non-fatal — the polling query catches up.
        },
      });
    return () => sub.unsubscribe();
  }, [dispatch, enabled, resourceKind, resourceUID]);
}
