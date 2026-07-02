import { BehaviorSubject } from 'rxjs';

// target is 20hz (50ms), but we poll at 100ms to smooth out jitter
const interval = 100;

class LiveTimer {
  budget = 1;
  threshold = 1.5; // trial and error appears about right
  ok = new BehaviorSubject(true);
  lastUpdate = Date.now();

  // Called at the consistent dashboard interval
  measure = () => {
    const now = Date.now();
    this.budget = (now - this.lastUpdate) / interval;

    const oldOk = this.ok.getValue();
    const newOk = this.budget <= this.threshold;
    if (oldOk !== newOk) {
      this.ok.next(newOk);
    }
    this.lastUpdate = now;
  };
}

export const liveTimer = new LiveTimer();
setInterval(liveTimer.measure, interval);
