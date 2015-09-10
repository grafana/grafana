///<reference path="../../headers/require/require.d.ts" />
///<reference path="../../headers/angularjs/angularjs.d.ts" />
///<amd-dependency path="angular"/>
///<amd-dependency path="config"/>
///<amd-dependency path="moment"/>
///<amd-dependency path="lodash"/>

var angular = require('angular');
var jquery = require('jquery');
var moment = require('moment');
var _ = require('lodash');

var module = angular.module('grafana.filters');

module.filter('stringSort', function() {
  return function(input) {
    return input.sort();
  };
});

module.filter('slice', function() {
  return function(arr, start, end) {
    if(!_.isUndefined(arr)) {
      return arr.slice(start, end);
    }
  };
});

module.filter('stringify', function() {
  return function(arr) {
    if(_.isObject(arr) && !_.isArray(arr)) {
      return angular.toJson(arr);
    } else {
      return _.isNull(arr) ? null : arr.toString();
    }
  };
});

module.filter('moment', function() {
  return function(date,mode) {
    switch(mode) {
      case 'ago':
        return moment(date).fromNow();
    }
    return moment(date).fromNow();
  };
});

module.filter('noXml', function() {
  var noXml = function(text) {
  return _.isString(text)
    ? text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    : text;
  };
  return function(text) {
    return _.isArray(text)
      ? _.map(text, noXml)
      : noXml(text);
  };
});

module.filter('interpolateTemplateVars', function(templateSrv) {
  var interpolateTemplateVars : any = function (text, scope) {
    if (scope.panel) {
      return templateSrv.replaceWithText(text, scope.panel.scopedVars);
    } else {
      return templateSrv.replaceWithText(text, scope.row.scopedVars);
    }
  }

  interpolateTemplateVars.$stateful = true;

  return interpolateTemplateVars;
});

export function filters() {}
