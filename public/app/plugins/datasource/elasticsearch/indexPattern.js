define([
  'lodash',
  'moment',
],
function (_, moment) {
  'use strict';

  function IndexPattern(pattern, interval) {
    this.pattern = pattern;
    this.interval = interval;
  };

  IndexPattern.prototype.getIndexForToday = function() {
    if (this.interval) {
      return moment().format(this.pattern);
    } else {
      return this.pattern;
    }
  };


  IndexPattern.prototype.getIndexList = function(from, to) {

  };


  return IndexPattern;
})
