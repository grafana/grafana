/* global _ */

/*
 * Complex scripted dashboard
 * This script generates a dashboard object that Grafana can load. It also takes a number of user
 * supplied URL parameters (in the ARGS variable)
 *
 * Global accessible variables
 * window, document, $, jQuery, ARGS, moment
 *
 * Return a dashboard object, or a function
 *
 * For async scripts, return a function, this function must take a single callback function,
 * call this function with the dashboard object
 */

'use strict';

// accessible variables in this scope
// let window, document, ARGS, $, jQuery, moment, kbn;

return function (callback) {
  // Setup some variables
  let dashboard;

  // Initialize a skeleton with nothing but a rows array and service object
  dashboard = {
    rows: [],
    services: {},
  };

  // Set a title
  dashboard.title = 'Scripted dash';

  // Set default time
  // time can be overridden in the url using from/to parameters, but this is
  // handled automatically in grafana core during dashboard initialization
  dashboard.time = {
    from: 'now-6h',
    to: 'now',
  };

  let rows = 1;
  let seriesName = 'argName';

  if (!_.isUndefined(ARGS.rows)) {
    rows = parseInt(ARGS.rows, 10);
  }

  if (!_.isUndefined(ARGS.name)) {
    seriesName = ARGS.name;
  }

  $.ajax({
    method: 'GET',
    url: '/',
  }).done(function (result) {
    dashboard.rows.push({
      title: 'Chart',
      height: '300px',
      panels: [
        {
          id: 1,
          title: 'Async dashboard test',
          type: 'text',
          span: 12,
          fill: 1,
          content: '# Async test',
        },
      ],
    });

    // when dashboard is composed call the callback
    // function and pass the dashboard
    callback(dashboard);
  });
};
