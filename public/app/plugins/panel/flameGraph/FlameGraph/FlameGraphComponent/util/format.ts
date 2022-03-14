export function numberWithCommas(x: number): string {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPercent(ratio: number) {
  const percent = ratioToPercent(ratio);
  return `${percent}%`;
}

export function ratioToPercent(ratio: number) {
  return Math.round(10000 * ratio) / 100;
}

export enum Units {
  Samples = 'samples',
  Objects = 'objects',
  Bytes = 'bytes',
}
export function getFormatter(max: number, sampleRate: number, units: Units) {
  switch (units) {
    case Units.Samples:
      return new DurationFormatter(max / sampleRate);
    case Units.Objects:
      return new ObjectsFormatter(max);
    case Units.Bytes:
      return new BytesFormatter(max);
    default:
      //  throw new Error(`Unsupported unit: ${units}`);
      return new DurationFormatter(max / sampleRate);
  }
}

//// this is a class and not a function because we can save some time by
////   precalculating divider and suffix and not doing it on each iteration
class DurationFormatter {
  divider = 1;
  suffix = 'second';
  durations: Array<[number, string]> = [
    [60, 'minute'],
    [60, 'hour'],
    [24, 'day'],
    [30, 'month'],
    [12, 'year'],
  ];
  constructor(maxDur: number) {
    for (var i = 0; i < this.durations.length; i++) {
      if (maxDur >= this.durations[i][0]) {
        this.divider *= this.durations[i][0];
        maxDur /= this.durations[i][0];
        this.suffix = this.durations[i][1];
      } else {
        break;
      }
    }
  }

  format(samples: number, sampleRate: number) {
    let n: any = samples / sampleRate / this.divider;
    let nStr = n.toFixed(2);

    if (n >= 0 && n < 0.01) {
      nStr = '< 0.01';
    } else if (n <= 0 && n > -0.01) {
      nStr = '< 0.01';
    }

    return `${nStr} ${this.suffix}` + (n === 1 ? '' : 's');
  }
}

export class ObjectsFormatter {
  divider = 1;
  suffix = '';
  objects: Array<[number, string]> = [
    [1000, 'K'],
    [1000, 'M'],
    [1000, 'G'],
    [1000, 'T'],
    [1000, 'P'],
  ];
  constructor(maxObjects: number) {
    for (var i = 0; i < this.objects.length; i++) {
      if (maxObjects >= this.objects[i][0]) {
        this.divider *= this.objects[i][0];
        maxObjects /= this.objects[i][0];
        this.suffix = this.objects[i][1];
      } else {
        break;
      }
    }
  }

  // TODO:
  // how to indicate that sampleRate doesn't matter?
  format(samples: number, sampleRate: number) {
    let n = samples / this.divider;
    let nStr = n.toFixed(2);

    if (n >= 0 && n < 0.01) {
      nStr = '< 0.01';
    } else if (n <= 0 && n > -0.01) {
      nStr = '< 0.01';
    }
    return `${nStr} ${this.suffix}`;
  }
}

export class BytesFormatter {
  divider = 1;
  suffix = 'bytes';
  bytes: Array<[number, string]> = [
    [1024, 'KB'],
    [1024, 'MB'],
    [1024, 'GB'],
    [1024, 'TB'],
    [1024, 'PB'],
  ];
  constructor(maxBytes: number) {
    for (var i = 0; i < this.bytes.length; i++) {
      if (maxBytes >= this.bytes[i][0]) {
        this.divider *= this.bytes[i][0];
        maxBytes /= this.bytes[i][0];
        this.suffix = this.bytes[i][1];
      } else {
        break;
      }
    }
  }

  format(samples: number, sampleRate: number) {
    let n = samples / this.divider;
    let nStr = n.toFixed(2);

    if (n >= 0 && n < 0.01) {
      nStr = '< 0.01';
    } else if (n <= 0 && n > -0.01) {
      nStr = '< 0.01';
    }

    return `${nStr} ${this.suffix}`;
  }
}
