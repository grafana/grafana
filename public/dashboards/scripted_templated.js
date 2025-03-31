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
// let window, document, $, jQuery, moment, kbn;

// Setup some variables
let dashboard;

// All url parameters are available via the ARGS object
// eslint-disable-next-line no-redeclare
// let ARGS;

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
      hide: 2,
      includeAll: false,
      multi: false,
      query: 'a,b,c\n',
      skipUrlSync: false,
      type: 'custom',
    },
    {
      name: 'seriesName',
      label: 'Series name',
      hide: 0,
      includeAll: false,
      multi: false,
      query: 'series1,series2,series3\n',
      skipUrlSync: false,
      type: 'custom',
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
        id: 1,
        title: 'Events',
        type: 'graph',
        span: 12,
        fill: 1,
        linewidth: 2,
        targets: [
          {
            scenarioId: 'random_walk',
            refId: 'A',
            seriesCount: 1,
            alias: seriesName,
          },
          {
            scenarioId: 'random_walk',
            refId: 'B',
            seriesCount: 1,
            alias: '${seriesName}',
          },
        ],
      },
    ],
  });
}

return dashboard;
