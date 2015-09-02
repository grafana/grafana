define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('uiSegmentSrv', function($sce, templateSrv) {

    function MetricSegment(options) {
      if (options === '*' || options.value === '*') {
        this.value = '*';
        this.html = $sce.trustAsHtml('<i class="fa fa-asterisk"><i>');
        this.expandable = true;
        return;
      }

      if (_.isString(options)) {
        this.value = options;
        this.html = $sce.trustAsHtml(this.value);
        return;
      }

      this.cssClass = options.cssClass;
      this.type = options.type;
      this.fake = options.fake;
      this.value = options.value;
      this.type = options.type;
      this.expandable = options.expandable;
      this.html = options.html || $sce.trustAsHtml(templateSrv.highlightVariablesAsHtml(this.value));
    }

    this.getSegmentForValue = function(value, fallbackText) {
      if (value) {
        return this.newSegment(value);
      } else {
        return this.newSegment({value: fallbackText, fake: true});
      }
    };

    this.newSelectMeasurement = function() {
      return new MetricSegment({value: 'select measurement', fake: true});
    };

    this.newFake = function(text, type, cssClass) {
      return new MetricSegment({value: text, fake: true, type: type, cssClass: cssClass});
    };

    this.newSegment = function(options) {
      return new MetricSegment(options);
    };

    this.newKey = function(key) {
      return new MetricSegment({value: key, type: 'key', cssClass: 'query-segment-key' });
    };

    this.newKeyValue = function(value) {
      return new MetricSegment({value: value, type: 'value', cssClass: 'query-segment-value' });
    };

    this.newCondition = function(condition) {
      return new MetricSegment({value: condition, type: 'condition', cssClass: 'query-keyword' });
    };

    this.newOperator = function(op) {
      return new MetricSegment({value: op, type: 'operator', cssClass: 'query-segment-operator' });
    };

    this.newOperators = function(ops) {
      return _.map(ops, function(op) {
        return new MetricSegment({value: op, type: 'operator', cssClass: 'query-segment-operator' });
      });
    };

    this.newSelectMetric = function() {
      return new MetricSegment({value: 'select metric', fake: true});
    };

    this.newPlusButton = function() {
      return new MetricSegment({fake: true, html: '<i class="fa fa-plus "></i>', type: 'plus-button' });
    };

    this.newSelectTagValue = function() {
      return new MetricSegment({value: 'select tag value', fake: true});
    };

  });

});
