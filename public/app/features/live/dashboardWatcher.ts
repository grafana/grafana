import { ChannelHandler, getGrafanaLiveSrv } from '@grafana/runtime';
import { getPageTracker, PageEvent } from './pageTracker';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import { PartialObserver, Subscription } from 'rxjs';
import { browserSessionId } from './live';

export enum DashboardEventAction {
  Saved = 'saved',
  Editing = 'editing', // Sent when someone goes to the editor
  Deleted = 'deleted',
}

export interface DashboardEvent {
  uid: string;
  action: DashboardEventAction;
  userId: number;
  sessionId?: string;
}

const dashboardChannelHandler: ChannelHandler<DashboardEvent> = {
  onPublish: (v: DashboardEvent) => {
    return v; // Just pass the object along
  },
};

const dashboardWatcher: PartialObserver<DashboardEvent> = {
  next: (event: DashboardEvent) => {
    if (event.sessionId !== browserSessionId) {
      if (event.action === DashboardEventAction.Saved) {
        const dash = getDashboardSrv().getCurrent();
        if (dash.uid === event.uid) {
          // force browser refresh -- cheap hack!
          console.log('Someone else saved... reload', event);
          location.reload();
        }
      } else {
        console.log('DashboardEvent EVENT', event);
      }
    }
  },
};

export function registerDashboardWatcher() {
  let uid: string | undefined = undefined;
  let sub: Subscription | undefined = undefined;
  let wasEditing = false;

  getPageTracker().subscribe({
    next: (evt: PageEvent) => {
      const editing = !!(evt.query && evt.query.indexOf('edit') >= 0);
      if (evt.isNewPage) {
        const dash = getDashboardSrv().getCurrent();
        if (uid !== dash?.uid) {
          if (sub) {
            sub.unsubscribe(); //
            sub = undefined;
          }

          const live = getGrafanaLiveSrv();
          if (uid) {
            console.log('CLOSE CHANNEL TO', uid);
            live.closeChannelStream(`grafana/dashboard/${uid}`); // Will remove all subscriptions
          }
          if (dash) {
            console.log('SUBSCRIBE TO', dash.uid);
            sub = live
              .initChannel<DashboardEvent>(`grafana/dashboard/${dash.uid}`, dashboardChannelHandler)
              .subscribe(dashboardWatcher);
          }
        }
        uid = dash.uid;
      }
      if (uid && editing !== wasEditing) {
        const user = (window as any).grafanaBootData.user;
        const live = getGrafanaLiveSrv();
        console.log('Editing dashboard', evt);
        live.publish(`grafana/dashboard/${uid}`, {
          uid,
          action: DashboardEventAction.Editing,
          userId: user.id,
          sessionId: browserSessionId,
        });
      }
      wasEditing = editing;
    },
  });
}
