import _ from 'lodash';
import { QueryCtrl } from './sdk/sdk';

export class MetaQueriesQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  errors: any;
  query: any;
  metric: any;
  addAggregatorMode: boolean;
  addPostAggregatorMode: boolean;
  addDimensionsMode: boolean;
  addMetricsMode: boolean;
  listDataSources: any;
  getDimensionsAndMetrics: any;
  getMetrics: any;
  getDimensions: any;
  getTargets: any;
  getQueryLetters: any;
  queryTypes: any;
  filterTypes: any;
  aggregatorTypes: any;
  postAggregatorTypes: any;
  arithmeticPostAggregator: any;
  customGranularity: any;
  target: any;
  datasource: any;

  queryTypeValidators = {
    TimeShift: this.validateTimeShiftQuery.bind(this),
    MovingAverage: this.validateMovingAverageQuery.bind(this),
    Arithmetic: this.validateArithmeticQuery.bind(this),
  };

  defaultQueryType = 'TimeShift';

  defaultPeriods = 7;

  /** @ngInject **/
  constructor($scope, $injector, $q) {
    super($scope, $injector);
    if (!this.target.queryType) {
      this.target.queryType = this.defaultQueryType;
    }

    this.queryTypes = _.keys(this.queryTypeValidators);

    this.errors = this.validateTarget();

    if (!this.target.periods) {
      this.clearPeriods();
    }

    this.getQueryLetters = (query, callback) => {
      return this.datasource.getTargets().then(function(targets) {
        callback(
          targets.map(function(item) {
            return item.refId;
          })
        );
      });
    };
  }

  targetBlur() {
    this.errors = this.validateTarget();
    this.refresh();
  }

  clearPeriods() {
    this.target.periods = this.defaultPeriods;
    this.targetBlur();
  }

  // isValidQuery(type) {
  //   return _.has(this.filterValidators, type);
  // }

  isValidQueryType(type) {
    return _.has(this.queryTypeValidators, type);
  }

  validateMovingAverageQuery(target, errs) {
    if (!target.periods) {
      errs.periods = 'Must list specify the period for moving average';
      return false;
    }
    var intPeriods = parseInt(target.periods);
    if (isNaN(intPeriods)) {
      errs.periods = 'Periods must be an integer';
      return false;
    }
    return true;
  }

  validateArithmeticQuery(target, errs) {
    if (!target.expression || target.expression.length == 0) {
      errs.expression = 'Must specify a javascript expression';
      return false;
    }
    return true;
  }
  validateTimeShiftQuery(target, errs) {
    if (!target.periods) {
      errs.periods = 'Must list specify the period for moving average';
      return false;
    }
    var intPeriods = parseInt(target.periods);
    if (isNaN(intPeriods)) {
      errs.periods = 'Periods must be an integer';
      return false;
    }
    return true;
  }

  validateTarget() {
    var errs: any = {};

    if (!this.target.queryType) {
      errs.queryType = 'You must supply a query type.';
    } else if (!this.isValidQueryType(this.target.queryType)) {
      (errs.queryType = 'Unknown query type: '), this.target.queryType, '.';
    } else {
      this.queryTypeValidators[this.target.queryType](this.target, errs);
    }

    if (this.query) {
      // if (!this.isValidQuery(this.query)) {
      //   errs.query = "Invalid Query type: "  this.query  ".";
      // }
    }

    return errs;
  }
}
