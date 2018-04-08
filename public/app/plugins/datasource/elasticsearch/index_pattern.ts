import moment from 'moment';

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
      return moment.utc().format(this.pattern);
    } else {
      return this.pattern;
    }
  }

  getIndexList(from, to) {
    if (!this.interval) {
      return this.pattern;
    }

    var intervalInfo = intervalMap[this.interval];
    var start = moment(from)
      .utc()
      .startOf(intervalInfo.startOf);
    var endEpoch = moment(to)
      .utc()
      .startOf(intervalInfo.startOf)
      .valueOf();
    var indexList = [];

    while (start.valueOf() <= endEpoch) {
      indexList.push(start.format(this.pattern));
      start.add(1, intervalInfo.amount);
    }

    return indexList;
  }
}
