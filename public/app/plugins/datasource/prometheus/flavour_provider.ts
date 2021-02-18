import { durationToMs } from './language_utils';

export enum PrometheusFlavour {
  Prometheus = 'Prometheus',
  Thanos = 'Thanos',
}

export class PrometheusFlavourProvider {
  flavour: PrometheusFlavour;
  // retentionPolicies contains pairs <downsampling level in seconds, retention in milliseconds>
  // sorted by downsampling level.
  retentionPolicies: Array<{ [level: number]: number }>;

  constructor(flavour: PrometheusFlavour, retentionPolicies: string) {
    if (flavour) {
      this.flavour = flavour;
    } else {
      this.flavour = PrometheusFlavour.Prometheus;
    }
    this.retentionPolicies = this.prepareRetentionPolicies(retentionPolicies);
  }

  adjustRateInterval(rateInterval: number, start: number): number {
    // Works for Prometheus and Thanos alike.
    return Math.max(rateInterval, 2 * this.getDownsampledInterval(start));
  }

  adjustInstantRequestData(data: Record<string, string>, time: number): Record<string, string> {
    // Works for Prometheus and Thanos alike.
    const downsampledInterval = this.getDownsampledInterval(time);
    if (downsampledInterval > 0) {
      data['max_source_resolution'] = downsampledInterval + 's';
    }
    return data;
  }

  private getDownsampledInterval(time: number): number {
    const now = Date.now();
    let downsampledInterval = 0;
    let left = now;
    let l: number;
    time = time * 1000;
    for (let rp of this.retentionPolicies) {
      l = now - rp[1];
      if (l < left) {
        downsampledInterval = rp[0];
        left = l;
      }
      if (left <= time) {
        break;
      }
    }
    return downsampledInterval;
  }

  private prepareRetentionPolicies(s: string): Array<{ [level: number]: number }> {
    let rp: Array<{ [level: number]: number }> = [];
    if (this.flavour === PrometheusFlavour.Thanos) {
      rp = this.prepareThanosRetentionPolicies(s);
    }
    return rp;
  }

  private prepareThanosRetentionPolicies(s: string): Array<{ [level: number]: number }> {
    let rp: Array<{ [level: number]: number }> = [];
    if (!s) {
      return rp;
    }
    const j = JSON.parse(s);
    for (let level in j) {
      if (!j.hasOwnProperty(level)) {
        continue;
      }
      let d = durationToMs(j[level]);
      if (d === 0) {
        d = Number.POSITIVE_INFINITY;
      }
      rp.push([parseInt(level, 10), d]);
    }
    rp = rp.sort((a, b) => {
      return a[0] - b[0];
    });
    return rp;
  }
}
