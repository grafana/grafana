/* global _ */

/*
 * Complex scripted dashboard
 * This script generates a dashboard object that Grafana can load. It also takes a number of user
 * supplied URL parameters (int ARGS variable)
 *
 * Return a dashboard object, or a function
 *
 * For async scripts, return a function, this function must take a single callback function as argument,
 * call this callback function with the dashboard object (look at scripted_async.js for an example)
 */

'use strict';

// accessible variables in this scope
let window, document, $, jQuery, moment, kbn;

// Setup some variables
let dashboard;

// All url parameters are available via the ARGS object
// eslint-disable-next-line no-redeclare
let ARGS;

// Initialize a skeleton with nothing but a rows array and service object
dashboard = {
  rows: [],
  schemaVersion: 13,
};

// Set a title
dashboard.title = 'Scripted and templated dash';

// Set default time
// time can be overridden in the url using from/to parameters, but this is
// handled automatically in grafana core during dashboard initialization
dashboard.time = {
  from: 'now-6h',
  to: 'now',
};

dashboard.templating = {
  list: [
    {
      name: 'test',
      query: 'apps.backend.*',
      refresh: 1,
      type: 'query',
      datasource: null,
      hide: 2,
    },
    {
      name: 'test2',
      query: '*',
      refresh: 1,
      type: 'query',
      datasource: null,
      hide: 2,
    },
  ],
};

let rows = 1;
let seriesName = 'argName';

if (!_.isUndefined(ARGS.rows)) {
  rows = parseInt(ARGS.rows, 10);
}

if (!_.isUndefined(ARGS.name)) {
  seriesName = ARGS.name;
}

for (let i = 0; i < rows; i++) {
  dashboard.rows.push({
    title: 'Chart',
    height: '300px',
    panels: [
      {
        title: 'Events',
        type: 'graph',
        span: 12,
        fill: 1,
        linewidth: 2,
        targets: [
          {
            target: "randomWalk('" + seriesName + "')",
          },
          {
            target: "randomWalk('[[test2]]')",
          },
        ],
      },
    ],
  });
}

return dashboard;
