import _ from 'lodash';
import coreModule from '../core_module';

/** @ngInject */
export function uiSegmentSrv(this: any, $sce, templateSrv) {
  const self = this;

  function MetricSegment(this: any, options) {
    if (options === '*' || options.value === '*') {
      this.value = '*';
      this.html = $sce.trustAsHtml('<i class="fa fa-asterisk"><i>');
      this.type = options.type;
      this.expandable = true;
      return;
    }

    if (_.isString(options)) {
      this.value = options;
      this.html = $sce.trustAsHtml(templateSrv.highlightVariablesAsHtml(this.value));
      return;
    }

    // temp hack to work around legacy inconsistency in segment model
    this.text = options.value;

    this.cssClass = options.cssClass;
    this.custom = options.custom;
    this.type = options.type;
    this.fake = options.fake;
    this.value = options.value;
    this.selectMode = options.selectMode;
    this.type = options.type;
    this.expandable = options.expandable;
    this.html = options.html || $sce.trustAsHtml(templateSrv.highlightVariablesAsHtml(this.value));
  }

  this.getSegmentForValue = function(value, fallbackText) {
    if (value) {
      return this.newSegment(value);
    } else {
      return this.newSegment({ value: fallbackText, fake: true });
    }
  };

  this.newSelectMeasurement = () => {
    return new MetricSegment({ value: 'select measurement', fake: true });
  };

  this.newFake = (text, type, cssClass) => {
    return new MetricSegment({ value: text, fake: true, type: type, cssClass: cssClass });
  };

  this.newSegment = options => {
    return new MetricSegment(options);
  };

  this.newKey = key => {
    return new MetricSegment({ value: key, type: 'key', cssClass: 'query-segment-key' });
  };

  this.newKeyValue = value => {
    return new MetricSegment({ value: value, type: 'value', cssClass: 'query-segment-value' });
  };

  this.newCondition = condition => {
    return new MetricSegment({ value: condition, type: 'condition', cssClass: 'query-keyword' });
  };

  this.newOperator = op => {
    return new MetricSegment({ value: op, type: 'operator', cssClass: 'query-segment-operator' });
  };

  this.newOperators = ops => {
    return _.map(ops, op => {
      return new MetricSegment({ value: op, type: 'operator', cssClass: 'query-segment-operator' });
    });
  };

  this.transformToSegments = (addTemplateVars, variableTypeFilter) => {
    return results => {
      const segments = _.map(results, segment => {
        return self.newSegment({ value: segment.text, expandable: segment.expandable });
      });

      if (addTemplateVars) {
        _.each(templateSrv.variables, variable => {
          if (variableTypeFilter === void 0 || variableTypeFilter === variable.type) {
            segments.unshift(self.newSegment({ type: 'value', value: '$' + variable.name, expandable: true }));
          }
        });
      }

      return segments;
    };
  };

  this.newSelectMetric = () => {
    return new MetricSegment({ value: 'select metric', fake: true });
  };

  this.newPlusButton = () => {
    return new MetricSegment({
      fake: true,
      html: '<i class="fa fa-plus "></i>',
      type: 'plus-button',
      cssClass: 'query-part',
    });
  };
}

coreModule.service('uiSegmentSrv', uiSegmentSrv);
