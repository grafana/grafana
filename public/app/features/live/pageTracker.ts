import { Observable, ReplaySubject } from 'rxjs';

export interface PageEvent {
  page: string;
  query?: string;
  isNewPage: boolean;
}

class PageTracker {
  private prevPage = 'x%34/!';
  private href = 'x';
  subject = new ReplaySubject<PageEvent>(1);

  check(url: string) {
    if (this.href !== url) {
      //this.live.update(document.location.href);
      const idx = url.indexOf('?');
      const page = idx > 0 ? url.substring(0, idx) : url;

      const evt: PageEvent = {
        isNewPage: page !== this.prevPage,
        page,
      };
      if (idx > 0) {
        evt.query = url.substring(idx + 1);
      }

      this.prevPage = page;
      this.href = url;

      this.subject.next(evt);
    }
  }

  watchLocationHref(interval = 500) {
    window.setInterval(this.watchLocation, interval);
  }

  private watchLocation = () => {
    this.check(document.location.href);
  };
}

let tracker: PageTracker | undefined = undefined;

export function getPageTracker(): Observable<PageEvent> {
  if (!tracker) {
    tracker = new PageTracker();
    tracker.watchLocationHref(500); // 2hz
  }
  return tracker.subject;
}
