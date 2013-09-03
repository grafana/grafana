/* Complex scripted Logstash dashboard */


var dashboard, ARGS, queries;

// arguments[0] contains a hash of the URL parameters, make it shorter
ARGS = arguments[0];

// Intialize a skeleton with nothing but a rows array and service object
dashboard = {
  rows : [],
  services : {}
};

// Set a title
dashboard.title = 'Logstash Search';

// Allow the user to set the index, if they dont, fall back to logstash.
if(!_.isUndefined(ARGS.index)) {
  dashboard.index = {
    default: ARGS.index,
    interval: 'none'
  }
} else {
  dashboard.index = {
    default: ARGS.index||'ADD_A_TIME_FILTER',
    pattern: ARGS.pattern||'[logstash-]YYYY.MM.DD',
    interval: ARGS.interval||'day'
  }
}

// In this dashboard we let users pass queries as comma seperated list to the query parameter.
// Or they can specify a split character using the split aparameter
// If query is defined, split it into a list of query objects
// NOTE: ids must be integers, hence the parseInt()s
if(!_.isUndefined(ARGS.query)) {
  queries = _.object(_.map(ARGS.query.split(ARGS.split||','), function(v,k) {
    return [k,{
      query: v,
      id: parseInt(k),
      alias: v
    }];
  }));
} else {
  // No queries passed? Initialize a single query to match everything
  queries = {
    0: {
      query: '*',
      id: 0
    }
  }
}

// Now populate the query service with our objects
dashboard.services.query = {
  list : queries,
  ids : _.map(_.keys(queries),function(v){return parseInt(v);})
}

// Lets also add a default time filter, the value of which can be specified by the user
dashboard.services.filter = {
  list: {
    0: {
      from: kbn.time_ago(ARGS.from||'15m'),
      to: new Date(),
      field: ARGS.timefield||"@timestamp",
      type: "time",
      active: true,
      id: 0
    }
  },
  ids: [0]
}

// Ok, lets make some rows. The Filters row is collapsed by default
dashboard.rows = [
  {
    title: "Input",
    height: "30px"
  },
  {
    title: "Filters",
    height: "100px",
    collapse: true
  },
  {
    title: "Chart",
    height: "300px"
  },
  {
    title: "Events",
    height: "400px"
  }
];

// Setup some panels. A query panel and a filter panel on the same row
dashboard.rows[0].panels = [
  {
    type: 'query',
    span: 7
  },
  {
    type: 'timepicker',
    span: 5,
    timespan: ARGS.from||'15m'
  }
];

// Add a filtering panel to the 2nd row
dashboard.rows[1].panels = [
  {
    type: 'filtering'
  }
]

// And a histogram that allows the user to specify the interval and time field
dashboard.rows[2].panels = [
  {
    type: 'histogram',
    time_field: ARGS.timefield||"@timestamp",
    auto_int: true
  }
]

// And a table row where you can specify field and sort order
dashboard.rows[3].panels = [
  {
    type: 'table',
    fields: !_.isUndefined(ARGS.fields) ? ARGS.fields.split(',') : ['@timestamp','@message'],
    sort: !_.isUndefined(ARGS.sort) ? ARGS.sort.split(',') : [ARGS.timefield||'@timestamp','desc'],
    overflow: 'expand'
  }
]

// Now return the object and we're good!
return dashboard;