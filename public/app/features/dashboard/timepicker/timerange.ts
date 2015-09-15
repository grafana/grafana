///<reference path="../../../headers/common.d.ts" />

import _ = require('lodash');
import moment = require('moment');

var rangeOptions = [
  { from: 'now/d',    to: 'now/d',    display: 'Today',                 section: 0 },
  { from: 'now/w',    to: 'now/w',    display: 'This week',             section: 0 },

  { from: 'now/d',    to: 'now',      display: 'The day so far',        section: 0 },
  { from: 'now/w',    to: 'now',      display: 'Week to date',          section: 0 },
  // { from: 'now/M',    to: 'now/M',    display: 'This month',            section: 0 },
  // { from: 'now/y',    to: 'now/y',    display: 'This year',             section: 0 },
  //
  // { from: 'now-1d/d', to: 'now-1d/d', display: 'Yesterday',             section: 1 },
  // { from: 'now-2d/d', to: 'now-2d/d', display: 'Day before yesterday',  section: 1 },
  // { from: 'now-7d/d', to: 'now-7d/d', display: 'This day last week',    section: 1 },
  // { from: 'now-1w/w', to: 'now-1w/w', display: 'Previous week',         section: 1 },
  // { from: 'now-1M/M', to: 'now-1M/M', display: 'Previous month',        section: 1 },
  // { from: 'now-1y/y', to: 'now-1y/y', display: 'Previous year',         section: 1 },

  { from: 'now-5m',   to: 'now',      display: 'Last 5 minutes',        section: 2 },
  { from: 'now-15m',  to: 'now',      display: 'Last 15 minutes',       section: 2 },
  { from: 'now-30m',  to: 'now',      display: 'Last 30 minutes',       section: 2 },
  { from: 'now-1h',   to: 'now',      display: 'Last 1 hour',           section: 2 },
  { from: 'now-4h',   to: 'now',      display: 'Last 4 hours',          section: 2 },
  { from: 'now-12h',  to: 'now',      display: 'Last 12 hours',         section: 2 },
  { from: 'now-24h',  to: 'now',      display: 'Last 24 hours',         section: 2 },
  { from: 'now-7d',   to: 'now',      display: 'Last 7 days',           section: 2 },

  { from: 'now-30d',  to: 'now',      display: 'Last 30 days',          section: 3 },
  // { from: 'now-60d',  to: 'now',      display: 'Last 60 days',          section: 3 },
  // { from: 'now-90d',  to: 'now',      display: 'Last 90 days',          section: 3 },
  // { from: 'now-6M',   to: 'now',      display: 'Last 6 months',         section: 3 },
  // { from: 'now-1y',   to: 'now',      display: 'Last 1 year',           section: 3 },
  // { from: 'now-2y',   to: 'now',      display: 'Last 2 years',          section: 3 },
  // { from: 'now-5y',   to: 'now',      display: 'Last 5 years',          section: 3 },
];

var rangeIndex = {};
_.each(rangeOptions, function (frame) {
  rangeIndex[frame.from + ' to ' + frame.to] = frame;
});

export class TimeRange {

  static getRelativeTimesList(timepickerSettings) {
    return rangeOptions;
  }

  static describeRelativeTime(range) {
    var option = rangeIndex[range.from.toString() + ' to ' + range.to.toString()];
    if (option) {
      return option.display;
    }
    return "NA";
  }
}


