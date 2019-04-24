import TimeGrainConverter from '../time_grain_converter';

export default class AppInsightsQuerystringBuilder {
  aggregation = '';
  groupBy = '';
  timeGrainType = '';
  timeGrain = '';
  timeGrainUnit = '';
  filter = '';

  constructor(private from, private to, public grafanaInterval) {}

  setAggregation(aggregation) {
    this.aggregation = aggregation;
  }

  setGroupBy(groupBy) {
    this.groupBy = groupBy;
  }

  setInterval(timeGrainType, timeGrain, timeGrainUnit) {
    this.timeGrainType = timeGrainType;
    this.timeGrain = timeGrain;
    this.timeGrainUnit = timeGrainUnit;
  }

  setFilter(filter: string) {
    this.filter = filter;
  }

  generate() {
    let querystring = `timespan=${this.from.utc().format()}/${this.to.utc().format()}`;

    if (this.aggregation && this.aggregation.length > 0) {
      querystring += `&aggregation=${this.aggregation}`;
    }

    if (this.groupBy && this.groupBy.length > 0) {
      querystring += `&segment=${this.groupBy}`;
    }

    if (this.timeGrainType === 'specific' && this.timeGrain && this.timeGrainUnit) {
      querystring += `&interval=${TimeGrainConverter.createISO8601Duration(this.timeGrain, this.timeGrainUnit)}`;
    }

    if (this.timeGrainType === 'auto') {
      querystring += `&interval=${TimeGrainConverter.createISO8601DurationFromInterval(this.grafanaInterval)}`;
    }

    if (this.filter) {
      querystring += `&filter=${this.filter}`;
    }

    return querystring;
  }
}
