import TimegrainConverter from '../time_grain_converter';

export default class AzureMonitorFilterBuilder {
  aggregation: string;
  timeGrainInterval = '';
  dimension: string;
  dimensionFilter: string;
  allowedTimeGrains = ['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d'];

  constructor(
    private metricName: string,
    private from,
    private to,
    public timeGrain: string,
    public grafanaInterval: string
  ) {}

  setAllowedTimeGrains(timeGrains) {
    this.allowedTimeGrains = [];
    timeGrains.forEach(tg => {
      if (tg.value === 'auto') {
        this.allowedTimeGrains.push(tg.value);
      } else {
        this.allowedTimeGrains.push(TimegrainConverter.createKbnUnitFromISO8601Duration(tg.value));
      }
    });
  }

  setAggregation(agg) {
    this.aggregation = agg;
  }

  setDimensionFilter(dimension, dimensionFilter) {
    this.dimension = dimension;
    this.dimensionFilter = dimensionFilter;
  }

  generateFilter() {
    let filter = this.createDatetimeAndTimeGrainConditions();

    if (this.aggregation) {
      filter += `&aggregation=${this.aggregation}`;
    }

    if (this.metricName && this.metricName.trim().length > 0) {
      filter += `&metricnames=${this.metricName}`;
    }

    if (this.dimension && this.dimensionFilter && this.dimensionFilter.trim().length > 0) {
      filter += `&$filter=${this.dimension} eq '${this.dimensionFilter}'`;
    }

    return filter;
  }

  createDatetimeAndTimeGrainConditions() {
    const dateTimeCondition = `timespan=${this.from.utc().format()}/${this.to.utc().format()}`;

    if (this.timeGrain === 'auto') {
      this.timeGrain = this.calculateAutoTimeGrain();
    }
    const timeGrainCondition = `&interval=${this.timeGrain}`;

    return dateTimeCondition + timeGrainCondition;
  }

  calculateAutoTimeGrain() {
    const roundedInterval = TimegrainConverter.findClosestTimeGrain(this.grafanaInterval, this.allowedTimeGrains);

    return TimegrainConverter.createISO8601DurationFromInterval(roundedInterval);
  }
}
