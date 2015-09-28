# Plugin API

## Changelog

2.5 changed the `range` parameter in the `datasource.query` function's options parameter. This
parameter now holds a parsed range with `moment` dates `form` and `to`. To get
millisecond epoc from a `moment` you the function `valueOf`. The raw date range as represented
internally in grafana (which may be relative expressions like `now-5h`) is included in the
new property `rangeRaw` (on the options object).
