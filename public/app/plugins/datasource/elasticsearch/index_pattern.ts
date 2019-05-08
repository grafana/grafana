import { toUtc, dateTime } from '@grafana/ui/src/utils/moment_wrapper';

const intervalMap = {
  Hourly: { startOf: 'hour', amount: 'hours' },
  Daily: { startOf: 'day', amount: 'days' },
  Weekly: { startOf: 'isoWeek', amount: 'weeks' },
  Monthly: { startOf: 'month', amount: 'months' },
  Yearly: { startOf: 'year', amount: 'years' },
};

export class IndexPattern {
  constructor(private pattern, private interval: string | null) {}

  getIndexForToday() {
    if (this.interval) {
      return toUtc().format(this.pattern);
    } else {
      return this.pattern;
    }
  }

  getIndexList(from, to) {
    if (!this.interval) {
      return this.pattern;
    }

    const intervalInfo = intervalMap[this.interval];
    const start = dateTime(from)
      .utc()
      .startOf(intervalInfo.startOf);
    const endEpoch = dateTime(to)
      .utc()
      .startOf(intervalInfo.startOf)
      .valueOf();
    const indexList = [];

    while (start.valueOf() <= endEpoch) {
      indexList.push(start.format(this.pattern));
      start.add(1, intervalInfo.amount);
    }

    return indexList;
  }
}
