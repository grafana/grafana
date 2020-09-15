import { ChannelHandler, getGrafanaLiveSrv } from '@grafana/runtime';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import { Subscription } from 'rxjs';

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

class DashboardWatcher {
  uid?: string;
  sub?: Subscription;
  ignoreSave?: boolean;

  constructor() {}

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
          console.log('Someone else saved... reload', event);
          location.reload();
        }
        this.ignoreSave = false;
      } else {
        console.log('DashboardEvent EVENT', event);
      }
    },
  };
}

export const dashboardWatcher = new DashboardWatcher();

// export function registerDashboardWatcher() {
//   let uid: string | undefined = undefined;
//   let sub: Subscription | undefined = undefined;
//   let wasEditing = false;

//   getPageTracker().subscribe({
//     next: (evt: PageEvent) => {
//       const editing = !!(evt.query && evt.query.indexOf('edit') >= 0);
//       if (evt.isNewPage) {
//         const dash = getDashboardSrv().getCurrent();
//         if (uid !== dash?.uid) {
//           if (sub) {
//             sub.unsubscribe(); //
//             sub = undefined;
//           }

//           const live = getGrafanaLiveSrv();
//           if (uid) {
//             console.log('CLOSE CHANNEL TO', uid);
//             live.closeChannelStream(`grafana/dashboard/${uid}`); // Will remove all subscriptions
//           }
//           if (dash) {
//             console.log('SUBSCRIBE TO', dash.uid);
//             sub = live
//               .initChannel<DashboardEvent>(`grafana/dashboard/${dash.uid}`, dashboardChannelHandler)
//               .subscribe(dashboardWatcher);
//           }
//         }
//         uid = dash.uid;
//       }
//       if (uid && editing !== wasEditing) {
//         const user = (window as any).grafanaBootData.user;
//         const live = getGrafanaLiveSrv();
//         console.log('Editing dashboard', evt);
//         live.publish(`grafana/dashboard/${uid}`, {
//           uid,
//           action: DashboardEventAction.Editing,
//           userId: user.id,
//           sessionId: browserSessionId,
//         });
//       }
//       wasEditing = editing;
//     },
//   });
// }
