/* tslint:disable:max-line-length */
export const operatorTokens = [
  { text: '!between', hint: 'Matches the input that is outside the inclusive range.' },
  { text: 'as', hint: "Binds a name to the operator's input tabular expression." },
  { text: 'between', hint: 'Matches the input that is inside the inclusive range.' },
  {
    text: 'consume',
    hint:
      'The `consume` operator consumes the tabular data stream handed to it. It is\r\nmostly used for triggering the query side-effect without actually returning\r\nthe results back to the caller.',
  },
  { text: 'count', hint: 'Returns the number of records in the input record set.' },
  { text: 'datatable', hint: 'Returns a table whose schema and values are defined in the query itself.' },
  {
    text: 'distinct',
    hint: 'Produces a table with the distinct combination of the provided columns of the input table.',
  },
  { text: 'evaluate', hint: 'Invokes a service-side query extension (plugin).' },
  { text: 'extend', hint: 'Create calculated columns and append them to the result set.' },
  {
    text: 'externaldata',
    hint:
      'Returns a table whose schema is defined in the query itself, and whose data is read from an external raw file.',
  },
  {
    text: 'facet',
    hint:
      'Returns a set of tables, one for each specified column.\r\nEach table specifies the list of values taken by its column.\r\nAn additional table can be created by using the `with` clause.',
  },
  { text: 'find', hint: 'Finds rows that match a predicate across a set of tables.' },
  { text: 'fork', hint: 'Runs multiple consumer operators in parallel.' },
  { text: 'getschema', hint: 'Produce a table that represents a tabular schema of the input.' },
  { text: 'in', hint: 'Filters a recordset based on the provided set of values.' },
  { text: 'invoke', hint: 'Invokes lambda that receives the source of `invoke` as tabular parameter argument.' },
  {
    text: 'join',
    hint:
      'Merge the rows of two tables to form a new table by matching values of the specified column(s) from each table.',
  },
  { text: 'limit', hint: 'Return up to the specified number of rows.' },
  { text: 'make-series', hint: 'Create series of specified aggregated values along specified axis.' },
  { text: 'mvexpand', hint: 'Expands multi-value array or property bag.' },
  { text: 'order', hint: 'Sort the rows of the input table into order by one or more columns.' },
  { text: 'parse', hint: 'Evaluates a string expression and parses its value into one or more calculated columns.' },
  {
    text: 'print',
    hint:
      'Evaluates one or more scalar expressions and inserts the results (as a single-row table with as many columns as there are expressions) into the output.',
  },
  { text: 'project', hint: 'Select the columns to include, rename or drop, and insert new computed columns.' },
  { text: 'project-away', hint: 'Select what  columns to exclude from the input.' },
  { text: 'project-rename', hint: 'Renames columns in the result output.' },
  { text: 'range', hint: 'Generates a single-column table of values.' },
  { text: 'reduce', hint: 'Groups a set of strings together based on values similarity.' },
  { text: 'render', hint: 'Instructs the user agent to render the results of the query in a particular way.' },
  { text: 'sample', hint: 'Returns up to the specified number of random rows from the input table.' },
  {
    text: 'sample-distinct',
    hint:
      'Returns a single column that contains up to the specified number of distinct values of the requested column.',
  },
  { text: 'search', hint: 'The search operator provides a multi-table/multi-column search experience.' },
  { text: 'serialize', hint: 'Marks that order of the input row set is safe for window functions usage.' },
  { text: 'sort', hint: 'Sort the rows of the input table into order by one or more columns.' },
  { text: 'summarize', hint: 'Produces a table that aggregates the content of the input table.' },
  { text: 'take', hint: 'Return up to the specified number of rows.' },
  { text: 'top', hint: 'Returns the first *N* records sorted by the specified columns.' },
  {
    text: 'top-hitters',
    hint: 'Returns an approximation of the first *N* results (assuming skewed distribution of the input).',
  },
  {
    text: 'top-nested',
    hint: 'Produces hierarchical top results, where each level is a drill-down based on previous level values.',
  },
  { text: 'union', hint: 'Takes two or more tables and returns the rows of all of them.' },
  { text: 'where', hint: 'Filters a table to the subset of rows that satisfy a predicate.' },
];

export const functionTokens = [
  { text: 'abs', hint: 'Calculates the absolute value of the input.' },
  {
    text: 'acos',
    hint:
      'Returns the angle whose cosine is the specified number (the inverse operation of [`cos()`](cosfunction.md)) .',
  },
  { text: 'ago', hint: 'Subtracts the given timespan from the current UTC clock time.' },
  { text: 'any', hint: 'Returns random non-empty value from the specified expression values.' },
  {
    text: 'arg_max',
    hint:
      'Finds a row in the group that maximizes *ExprToMaximize*, and returns the value of *ExprToReturn* (or `*` to return the entire row).',
  },
  {
    text: 'arg_min',
    hint:
      'Finds a row in the group that minimizes *ExprToMinimize*, and returns the value of *ExprToReturn* (or `*` to return the entire row).',
  },
  {
    text: 'argmax',
    hint:
      'Finds a row in the group that maximizes *ExprToMaximize*, and returns the value of *ExprToReturn* (or `*` to return the entire row).',
  },
  {
    text: 'argmin',
    hint:
      'Finds a row in the group that minimizes *ExprToMinimize*, and returns the value of *ExprToReturn* (or `*` to return the entire row).',
  },
  { text: 'array_concat', hint: 'Concatenates a number of dynamic arrays to a single array.' },
  { text: 'array_length', hint: 'Calculates the number of elements in a dynamic array.' },
  { text: 'array_slice', hint: 'Extracts a slice of a dynamic array.' },
  {
    text: 'array_split',
    hint:
      'Splits an array to multiple arrays according to the split indices and packs the generated array in a dynamic array.',
  },
  {
    text: 'asin',
    hint: 'Returns the angle whose sine is the specified number (the inverse operation of [`sin()`](sinfunction.md)) .',
  },
  {
    text: 'assert',
    hint: 'Checks for a condition; if the condition is false, outputs error messages and fails the query.',
  },
  {
    text: 'atan',
    hint:
      'Returns the angle whose tangent is the specified number (the inverse operation of [`tan()`](tanfunction.md)) .',
  },
  {
    text: 'atan2',
    hint:
      'Calculates the angle, in radians, between the positive x-axis and the ray from the origin to the point (y, x).',
  },
  { text: 'avg', hint: 'Calculates the average of *Expr* across the group.' },
  {
    text: 'avgif',
    hint:
      'Calculates the [average](avg-aggfunction.md) of *Expr* across the group for which *Predicate* evaluates to `true`.',
  },
  { text: 'bag_keys', hint: 'Enumerates all the root keys in a dynamic property-bag object.' },
  { text: 'base64_decodestring', hint: 'Decodes a base64 string to a UTF-8 string' },
  { text: 'base64_encodestring', hint: 'Encodes a string as base64 string' },
  { text: 'beta_cdf', hint: 'Returns the standard cumulative beta distribution function.' },
  { text: 'beta_inv', hint: 'Returns the inverse of the beta cumulative probability beta density function.' },
  { text: 'beta_pdf', hint: 'Returns the probability density beta function.' },
  { text: 'bin', hint: 'Rounds values down to an integer multiple of a given bin size.' },
  {
    text: 'bin_at',
    hint:
      "Rounds values down to a fixed-size 'bin', with control over the bin's starting point.\r\n(See also [`bin function`](./binfunction.md).)",
  },
  {
    text: 'bin_auto',
    hint:
      "Rounds values down to a fixed-size 'bin', with control over the bin size and starting point provided by a query property.",
  },
  { text: 'binary_and', hint: 'Returns a result of the bitwise `and` operation between two values.' },
  { text: 'binary_not', hint: 'Returns a bitwise negation of the input value.' },
  { text: 'binary_or', hint: 'Returns a result of the bitwise `or` operation of the two values.' },
  { text: 'binary_shift_left', hint: 'Returns binary shift left operation on a pair of numbers.' },
  { text: 'binary_shift_right', hint: 'Returns binary shift right operation on a pair of numbers.' },
  { text: 'binary_xor', hint: 'Returns a result of the bitwise `xor` operation of the two values.' },
  { text: 'buildschema', hint: 'Returns the minimal schema that admits all values of *DynamicExpr*.' },
  {
    text: 'case',
    hint: 'Evaluates a list of predicates and returns the first result expression whose predicate is satisfied.',
  },
  {
    text: 'ceiling',
    hint: 'Calculates the smallest integer greater than, or equal to, the specified numeric expression.',
  },
  { text: 'cluster', hint: 'Changes the reference of the query to a remote cluster.' },
  {
    text: 'coalesce',
    hint: 'Evaluates a list of expressions and returns the first non-null (or non-empty for string) expression.',
  },
  { text: 'cos', hint: 'Returns the cosine function.' },
  { text: 'cot', hint: 'Calculates the trigonometric cotangent of the specified angle, in radians.' },
  {
    text: 'count',
    hint:
      'Returns a count of the records per summarization group (or in total if summarization is done without grouping).',
  },
  { text: 'countif', hint: 'Returns a count of rows for which *Predicate* evaluates to `true`.' },
  {
    text: 'countof',
    hint: 'Counts occurrences of a substring in a string. Plain string matches may overlap; regex matches do not.',
  },
  { text: 'current_principal', hint: 'Returns the current principal running this query.' },
  {
    text: 'cursor_after',
    hint: 'A predicate over the records of a table to compare their ingestion time\r\nagainst a database cursor.',
  },
  {
    text: 'cursor_before_or_at',
    hint: 'A predicate over the records of a table to compare their ingestion time\r\nagainst a database cursor.',
  },
  { text: 'database', hint: 'Changes the reference of the query to a specific database within the cluster scope.' },
  {
    text: 'datetime_add',
    hint:
      'Calculates a new [datetime](./scalar-data-types/datetime.md) from a specified datepart multiplied by a specified amount, added to a specified [datetime](./scalar-data-types/datetime.md).',
  },
  {
    text: 'datetime_diff',
    hint: 'Calculates calendarian difference between two [datetime](./scalar-data-types/datetime.md) values.',
  },
  { text: 'datetime_part', hint: 'Extracts the requested date part as an integer value.' },
  { text: 'dayofmonth', hint: 'Returns the integer number representing the day number of the given month' },
  { text: 'dayofweek', hint: 'Returns the integer number of days since the preceding Sunday, as a `timespan`.' },
  { text: 'dayofyear', hint: 'Returns the integer number represents the day number of the given year.' },
  { text: 'dcount', hint: 'Returns an estimate of the number of distinct values of *Expr* in the group.' },
  {
    text: 'dcount_hll',
    hint:
      'Calculates the dcount from hll results (which was generated by [hll](hll-aggfunction.md) or [hll_merge](hll-merge-aggfunction.md)).',
  },
  {
    text: 'dcountif',
    hint:
      'Returns an estimate of the number of distinct values of *Expr* of rows for which *Predicate* evaluates to `true`.',
  },
  {
    text: 'degrees',
    hint:
      'Converts angle value in radians into value in degrees, using formula `degrees = (180 / PI ) * angle_in_radians`',
  },
  { text: 'distance', hint: 'Returns the distance between two points in meters.' },
  { text: 'endofday', hint: 'Returns the end of the day containing the date, shifted by an offset, if provided.' },
  { text: 'endofmonth', hint: 'Returns the end of the month containing the date, shifted by an offset, if provided.' },
  { text: 'endofweek', hint: 'Returns the end of the week containing the date, shifted by an offset, if provided.' },
  { text: 'endofyear', hint: 'Returns the end of the year containing the date, shifted by an offset, if provided.' },
  {
    text: 'estimate_data_size',
    hint: 'Returns an estimated data size of the selected columns of the tabular expression.',
  },
  { text: 'exp', hint: 'The base-e exponential function of x, which is e raised to the power x: e^x.' },
  {
    text: 'exp10',
    hint: 'The base-10 exponential function of x, which is 10 raised to the power x: 10^x.  \r\n**Syntax**',
  },
  { text: 'exp2', hint: 'The base-2 exponential function of x, which is 2 raised to the power x: 2^x.' },
  {
    text: 'extent_id',
    hint: 'Returns a unique identifier that identifies the data shard ("extent") that the current record resides in.',
  },
  {
    text: 'extent_tags',
    hint:
      'Returns a dynamic array with the [tags](../management/extents-overview.md#extent-tagging) of the data shard ("extent") that the current record resides in.',
  },
  { text: 'extract', hint: 'Get a match for a [regular expression](./re2.md) from a text string.' },
  { text: 'extract_all', hint: 'Get all matches for a [regular expression](./re2.md) from a text string.' },
  { text: 'extractjson', hint: 'Get a specified element out of a JSON text using a path expression.' },
  { text: 'floor', hint: 'An alias for [`bin()`](binfunction.md).' },
  { text: 'format_datetime', hint: 'Formats a datetime parameter based on the format pattern parameter.' },
  { text: 'format_timespan', hint: 'Formats a timespan parameter based on the format pattern parameter.' },
  { text: 'gamma', hint: 'Computes [gamma function](https://en.wikipedia.org/wiki/Gamma_function)' },
  { text: 'getmonth', hint: 'Get the month number (1-12) from a datetime.' },
  { text: 'gettype', hint: 'Returns the runtime type of its single argument.' },
  { text: 'getyear', hint: 'Returns the year part of the `datetime` argument.' },
  { text: 'hash', hint: 'Returns a hash value for the input value.' },
  { text: 'hash_sha256', hint: 'Returns a sha256 hash value for the input value.' },
  { text: 'hll', hint: 'Calculates the Intermediate results of [dcount](dcount-aggfunction.md) across the group.' },
  {
    text: 'hll_merge',
    hint: 'Merges hll results (scalar version of the aggregate version [`hll_merge()`](hll-merge-aggfunction.md)).',
  },
  { text: 'hourofday', hint: 'Returns the integer number representing the hour number of the given date' },
  {
    text: 'iff',
    hint:
      'Evaluates the first argument (the predicate), and returns the value of either the second or third arguments, depending on whether the predicate evaluated to `true` (second) or `false` (third).',
  },
  {
    text: 'iif',
    hint:
      'Evaluates the first argument (the predicate), and returns the value of either the second or third arguments, depending on whether the predicate evaluated to `true` (second) or `false` (third).',
  },
  {
    text: 'indexof',
    hint: 'Function reports the zero-based index of the first occurrence of a specified string within input string.',
  },
  { text: 'ingestion_time', hint: "Retrieves the record's `$IngestionTime` hidden `datetime` column, or null." },
  {
    text: 'iscolumnexists',
    hint:
      'Returns a boolean value indicating if the given string argument exists in the schema produced by the preceding tabular operator.',
  },
  { text: 'isempty', hint: 'Returns `true` if the argument is an empty string or is null.' },
  { text: 'isfinite', hint: 'Returns whether input is a finite value (is neither infinite nor NaN).' },
  { text: 'isinf', hint: 'Returns whether input is an infinite (positive or negative) value.' },
  { text: 'isnan', hint: 'Returns whether input is Not-a-Number (NaN) value.' },
  { text: 'isnotempty', hint: 'Returns `true` if the argument is not an empty string nor it is a null.' },
  { text: 'isnotnull', hint: 'Returns `true` if the argument is not null.' },
  {
    text: 'isnull',
    hint:
      'Evaluates its sole argument and returns a `bool` value indicating if the argument evaluates to a null value.',
  },
  { text: 'log', hint: 'Returns the natural logarithm function.' },
  { text: 'log10', hint: 'Returns the common (base-10) logarithm function.' },
  { text: 'log2', hint: 'Returns the base-2 logarithm function.' },
  {
    text: 'loggamma',
    hint: 'Computes log of absolute value of the [gamma function](https://en.wikipedia.org/wiki/Gamma_function)',
  },
  {
    text: 'make_datetime',
    hint: 'Creates a [datetime](./scalar-data-types/datetime.md) scalar value from the specified date and time.',
  },
  {
    text: 'make_dictionary',
    hint: 'Returns a `dynamic` (JSON) property-bag (dictionary) of all the values of *Expr* in the group.',
  },
  { text: 'make_string', hint: 'Returns the string generated by the Unicode characters.' },
  {
    text: 'make_timespan',
    hint: 'Creates a [timespan](./scalar-data-types/timespan.md) scalar value from the specified time period.',
  },
  { text: 'makelist', hint: 'Returns a `dynamic` (JSON) array of all the values of *Expr* in the group.' },
  {
    text: 'makeset',
    hint: 'Returns a `dynamic` (JSON) array of the set of distinct values that *Expr* takes in the group.',
  },
  {
    text: 'materialize',
    hint:
      'Allows caching a sub-query result during the time of query execution in a way that other subqueries can reference the partial result.',
  },
  { text: 'max', hint: 'Returns the maximum value across the group.' },
  { text: 'max_of', hint: 'Returns the maximum value of several evaluated numeric expressions.' },
  {
    text: 'merge_tdigests',
    hint:
      'Merges tdigest results (scalar version of the aggregate version [`merge_tdigests()`](merge-tdigests-aggfunction.md)).',
  },
  { text: 'min', hint: 'Returns the minimum value agross the group.' },
  { text: 'min_of', hint: 'Returns the minimum value of several evaluated numeric expressions.' },
  { text: 'monthofyear', hint: 'Returns the integer number represents the month number of the given year.' },
  {
    text: 'next',
    hint:
      'Returns the value of a column in a row that it at some offset following the\r\ncurrent row in a [serialized row set](./windowsfunctions.md#serialized-row-set).',
  },
  { text: 'not', hint: 'Reverses the value of its `bool` argument.' },
  {
    text: 'now',
    hint:
      'Returns the current UTC clock time, optionally offset by a given timespan.\r\nThis function can be used multiple times in a statement and the clock time being referenced will be the same for all instances.',
  },
  { text: 'pack', hint: 'Creates a `dynamic` object (property bag) from a list of names and values.' },
  {
    text: 'pack_all',
    hint: 'Creates a `dynamic` object (property bag) from all the columns of the tabular expression.',
  },
  { text: 'pack_array', hint: 'Packs all input values into a dynamic array.' },
  { text: 'parse_ipv4', hint: 'Converts input to integer (signed 64-bit) number representation.' },
  {
    text: 'parse_json',
    hint:
      'Interprets a `string` as a [JSON value](https://json.org/)) and returns the value as [`dynamic`](./scalar-data-types/dynamic.md). \r\nIt is superior to using [extractjson() function](./extractjsonfunction.md)\r\nwhen you need to extract more than one element of a JSON compound object.',
  },
  {
    text: 'parse_path',
    hint:
      'Parses a file path `string` and returns a [`dynamic`](./scalar-data-types/dynamic.md) object that contains the following parts of the path: \r\nScheme, RootPath, DirectoryPath, DirectoryName, FileName, Extension, AlternateDataStreamName.\r\nIn addition to the simple paths with both types of slashes, supports paths with schemas (e.g. "file://..."), shared paths (e.g. "\\\\shareddrive\\users..."), long paths (e.g "\\\\?\\C:...""), alternate data streams (e.g. "file1.exe:file2.exe")',
  },
  {
    text: 'parse_url',
    hint:
      'Parses an absolute URL `string` and returns a [`dynamic`](./scalar-data-types/dynamic.md) object contains all parts of the URL (Scheme, Host, Port, Path, Username, Password, Query Parameters, Fragment).',
  },
  {
    text: 'parse_urlquery',
    hint:
      'Parses a url query `string` and returns a [`dynamic`](./scalar-data-types/dynamic.md) object contains the Query parameters.',
  },
  {
    text: 'parse_user_agent',
    hint:
      "Interprets a user-agent string, which identifies the user's browser and provides certain system details to servers hosting the websites the user visits. The result is returned as [`dynamic`](./scalar-data-types/dynamic.md).",
  },
  { text: 'parse_version', hint: 'Converts input string representation of version to a comparable decimal number.' },
  {
    text: 'parse_xml',
    hint:
      'Interprets a `string` as a XML value, converts the value to a [JSON value](https://json.org/) and returns the value as  [`dynamic`](./scalar-data-types/dynamic.md).',
  },
  {
    text: 'percentile',
    hint:
      'Returns an estimate for the specified [nearest-rank percentile](#nearest-rank-percentile) of the population defined by *Expr*. \r\nThe accuracy depends on the density of population in the region of the percentile.',
  },
  {
    text: 'percentile_tdigest',
    hint:
      'Calculates the percentile result from tdigest results (which was generated by [tdigest](tdigest-aggfunction.md) or [merge-tdigests](merge-tdigests-aggfunction.md))',
  },
  {
    text: 'percentrank_tdigest',
    hint:
      "Calculates the approximate rank of the value in a set where rank is expressed as percentage of set's size. \r\nThis function can be viewed as the inverse of the percentile.",
  },
  { text: 'pi', hint: 'Returns the constant value of Pi (π).' },
  { text: 'point', hint: 'Returns a dynamic array representation of a point.' },
  { text: 'pow', hint: 'Returns a result of raising to power' },
  {
    text: 'prev',
    hint:
      'Returns the value of a column in a row that it at some offset prior to the\r\ncurrent row in a [serialized row set](./windowsfunctions.md#serialized-row-set).',
  },
  {
    text: 'radians',
    hint:
      'Converts angle value in degrees into value in radians, using formula `radians = (PI / 180 ) * angle_in_degrees`',
  },
  { text: 'rand', hint: 'Returns a random number.' },
  { text: 'range', hint: 'Generates a dynamic array holding a series of equally-spaced values.' },
  { text: 'repeat', hint: 'Generates a dynamic array holding a series of equal values.' },
  { text: 'replace', hint: 'Replace all regex matches with another string.' },
  { text: 'reverse', hint: 'Function makes reverse of input string.' },
  { text: 'round', hint: 'Returns the rounded source to the specified precision.' },
  {
    text: 'row_cumsum',
    hint:
      'Calculates the cumulative sum of a column in a [serialized row set](./windowsfunctions.md#serialized-row-set).',
  },
  {
    text: 'row_number',
    hint:
      "Returns the current row's index in a [serialized row set](./windowsfunctions.md#serialized-row-set).\r\nThe row index starts by default at `1` for the first row, and is incremented by `1` for each additional row.\r\nOptionally, the row index can start at a different value than `1`.\r\nAdditionally, the row index may be reset according to some provided predicate.",
  },
  { text: 'series_add', hint: 'Calculates the element-wise addition of two numeric series inputs.' },
  { text: 'series_decompose', hint: 'Applies a decomposition transformation on a series.' },
  {
    text: 'series_decompose_anomalies',
    hint:
      'Anomaly Detection based on series decomposition (refer to [series_decompose()](series-decomposefunction.md))',
  },
  { text: 'series_decompose_forecast', hint: 'Forecast based on series decomposition.' },
  { text: 'series_divide', hint: 'Calculates the element-wise division of two numeric series inputs.' },
  {
    text: 'series_equals',
    hint: 'Calculates the element-wise equals (`==`) logic operation of two numeric series inputs.',
  },
  { text: 'series_fill_backward', hint: 'Performs backward fill interpolation of missing values in a series.' },
  { text: 'series_fill_const', hint: 'Replaces missing values in a series with a specified constant value.' },
  { text: 'series_fill_forward', hint: 'Performs forward fill interpolation of missing values in a series.' },
  { text: 'series_fill_linear', hint: 'Performs linear interpolation of missing values in a series.' },
  { text: 'series_fir', hint: 'Applies a Finite Impulse Response filter on a series.' },
  {
    text: 'series_fit_2lines',
    hint: 'Applies two segments linear regression on a series, returning multiple columns.',
  },
  {
    text: 'series_fit_2lines_dynamic',
    hint: 'Applies two segments linear regression on a series, returning dynamic object.',
  },
  { text: 'series_fit_line', hint: 'Applies linear regression on a series, returning multiple columns.' },
  { text: 'series_fit_line_dynamic', hint: 'Applies linear regression on a series, returning dynamic object.' },
  {
    text: 'series_greater',
    hint: 'Calculates the element-wise greater (`>`) logic operation of two numeric series inputs.',
  },
  {
    text: 'series_greater_equals',
    hint: 'Calculates the element-wise greater or equals (`>=`) logic operation of two numeric series inputs.',
  },
  { text: 'series_iir', hint: 'Applies a Infinite Impulse Response filter on a series.' },
  { text: 'series_less', hint: 'Calculates the element-wise less (`<`) logic operation of two numeric series inputs.' },
  {
    text: 'series_less_equals',
    hint: 'Calculates the element-wise less or equal (`<=`) logic operation of two numeric series inputs.',
  },
  { text: 'series_multiply', hint: 'Calculates the element-wise multiplication of two numeric series inputs.' },
  {
    text: 'series_not_equals',
    hint: 'Calculates the element-wise not equals (`!=`) logic operation of two numeric series inputs.',
  },
  { text: 'series_outliers', hint: 'Scores anomaly points in a series.' },
  { text: 'series_periods_detect', hint: 'Finds the most significant periods that exist in a time series.' },
  {
    text: 'series_periods_validate',
    hint: 'Checks whether a time series contains periodic patterns of given lengths.',
  },
  {
    text: 'series_seasonal',
    hint: 'Calculates the seasonal component of a series according to the detected or given seasonal period.',
  },
  { text: 'series_stats', hint: 'Returns statistics for a series in multiple columns.' },
  { text: 'series_stats_dynamic', hint: 'Returns statistics for a series in dynamic object.' },
  { text: 'series_subtract', hint: 'Calculates the element-wise subtraction of two numeric series inputs.' },
  { text: 'sign', hint: 'Sign of a numeric expression' },
  { text: 'sin', hint: 'Returns the sine function.' },
  {
    text: 'split',
    hint:
      'Splits a given string according to a given delimiter and returns a string array with the contained substrings.',
  },
  { text: 'sqrt', hint: 'Returns the square root function.' },
  { text: 'startofday', hint: 'Returns the start of the day containing the date, shifted by an offset, if provided.' },
  {
    text: 'startofmonth',
    hint: 'Returns the start of the month containing the date, shifted by an offset, if provided.',
  },
  {
    text: 'startofweek',
    hint: 'Returns the start of the week containing the date, shifted by an offset, if provided.',
  },
  {
    text: 'startofyear',
    hint: 'Returns the start of the year containing the date, shifted by an offset, if provided.',
  },
  {
    text: 'stdev',
    hint:
      'Calculates the standard deviation of *Expr* across the group, considering the group as a [sample](https://en.wikipedia.org/wiki/Sample_%28statistics%29).',
  },
  {
    text: 'stdevif',
    hint:
      'Calculates the [stdev](stdev-aggfunction.md) of *Expr* across the group for which *Predicate* evaluates to `true`.',
  },
  {
    text: 'stdevp',
    hint:
      'Calculates the standard deviation of *Expr* across the group, considering the group as a [population](https://en.wikipedia.org/wiki/Statistical_population).',
  },
  { text: 'strcat', hint: 'Concatenates between 1 and 64 arguments.' },
  { text: 'strcat_array', hint: 'Creates a concatenated string of array values using specified delimiter.' },
  {
    text: 'strcat_delim',
    hint: 'Concatenates between 2 and 64 arguments, with delimiter, provided as first argument.',
  },
  { text: 'strcmp', hint: 'Compares two strings.' },
  { text: 'string_size', hint: 'Returns the size, in bytes, of the input string.' },
  { text: 'strlen', hint: 'Returns the length, in characters, of the input string.' },
  { text: 'strrep', hint: 'Repeats given [string](./scalar-data-types/string.md) provided amount of times.' },
  {
    text: 'substring',
    hint: 'Extracts a substring from a source string starting from some index to the end of the string.',
  },
  { text: 'sum', hint: 'Calculates the sum of *Expr* across the group.' },
  { text: 'sumif', hint: 'Returns a sum of *Expr* for which *Predicate* evaluates to `true`.' },
  { text: 'table', hint: 'References specific table using an query-time evaluated string-expression.' },
  { text: 'tan', hint: 'Returns the tangent function.' },
  {
    text: 'tdigest',
    hint: 'Calculates the Intermediate results of [`percentiles()`](percentiles-aggfunction.md) across the group.',
  },
  {
    text: 'tdigest_merge',
    hint:
      'Merges tdigest results (scalar version of the aggregate version [`tdigest_merge()`](tdigest-merge-aggfunction.md)).',
  },
  { text: 'tobool', hint: 'Converts input to boolean (signed 8-bit) representation.' },
  { text: 'todatetime', hint: 'Converts input to [datetime](./scalar-data-types/datetime.md) scalar.' },
  { text: 'todecimal', hint: 'Converts input to decimal number representation.' },
  {
    text: 'todouble',
    hint: 'Converts the input to a value of type `real`. (`todouble()` and `toreal()` are synonyms.)',
  },
  {
    text: 'todynamic',
    hint:
      'Interprets a `string` as a [JSON value](https://json.org/) and returns the value as [`dynamic`](./scalar-data-types/dynamic.md).',
  },
  { text: 'toguid', hint: 'Converts input to [`guid`](./scalar-data-types/guid.md) representation.' },
  { text: 'tohex', hint: 'Converts input to a hexadecimal string.' },
  { text: 'toint', hint: 'Converts input to integer (signed 32-bit) number representation.' },
  { text: 'tolong', hint: 'Converts input to long (signed 64-bit) number representation.' },
  { text: 'tolower', hint: 'Converts input string to lower case.' },
  { text: 'toscalar', hint: 'Returns a scalar constant value of the evaluated expression.' },
  { text: 'tostring', hint: 'Converts input to a string representation.' },
  { text: 'totimespan', hint: 'Converts input  to [timespan](./scalar-data-types/timespan.md) scalar.' },
  { text: 'toupper', hint: 'Converts a string to upper case.' },
  {
    text: 'translate',
    hint:
      "Replaces a set of characters ('searchList') with another set of characters ('replacementList') in a given a string.\r\nThe function searches for characters in the 'searchList' and replaces them with the corresponding characters in 'replacementList'",
  },
  { text: 'treepath', hint: 'Enumerates all the path expressions that identify leaves in a dynamic object.' },
  { text: 'trim', hint: 'Removes all leading and trailing matches of the specified regular expression.' },
  { text: 'trim_end', hint: 'Removes trailing match of the specified regular expression.' },
  { text: 'trim_start', hint: 'Removes leading match of the specified regular expression.' },
  { text: 'url_decode', hint: 'The function converts encoded URL into a to regular URL representation.' },
  {
    text: 'url_encode',
    hint: 'The function converts characters of the input URL into a format that can be transmitted over the Internet.',
  },
  {
    text: 'variance',
    hint:
      'Calculates the variance of *Expr* across the group, considering the group as a [sample](https://en.wikipedia.org/wiki/Sample_%28statistics%29).',
  },
  {
    text: 'varianceif',
    hint:
      'Calculates the [variance](variance-aggfunction.md) of *Expr* across the group for which *Predicate* evaluates to `true`.',
  },
  {
    text: 'variancep',
    hint:
      'Calculates the variance of *Expr* across the group, considering the group as a [population](https://en.wikipedia.org/wiki/Statistical_population).',
  },
  { text: 'weekofyear', hint: 'Returns the integer number represents the week number.' },
  {
    text: 'welch_test',
    hint: 'Computes the p_value of the [Welch-test function](https://en.wikipedia.org/wiki/Welch%27s_t-test)',
  },
  {
    text: 'zip',
    hint:
      'The `zip` function accepts any number of `dynamic` arrays, and returns an\r\narray whose elements are each an array holding the elements of the input\r\narrays of the same index.',
  },
];

export const KEYWORDS = [
  'by',
  'on',
  'contains',
  'notcontains',
  'containscs',
  'notcontainscs',
  'startswith',
  'has',
  'matches',
  'regex',
  'true',
  'false',
  'and',
  'or',
  'typeof',
  'int',
  'string',
  'date',
  'datetime',
  'time',
  'long',
  'real',
  '​boolean',
  'bool',
];

export const grafanaMacros = [
  {
    text: '$__timeFilter',
    display: '$__timeFilter()',
    hint: 'Macro that uses the selected timerange in Grafana to filter the query.',
  },
  {
    text: '$__timeTo',
    display: '$__timeTo()',
    hint: 'Returns the From datetime from the Grafana picker. Example: datetime(2018-06-05T20:09:58.907Z).',
  },
  {
    text: '$__timeFrom',
    display: '$__timeFrom()',
    hint: 'Returns the From datetime from the Grafana picker. Example: datetime(2018-06-05T18:09:58.907Z).',
  },
  {
    text: '$__escapeMulti',
    display: '$__escapeMulti()',
    hint: 'Macro to escape multi-value template variables that contain illegal characters.',
  },
  { text: '$__contains', display: '$__contains()', hint: 'Macro for multi-value template variables.' },
];

// Kusto operators
// export const OPERATORS = ['+', '-', '*', '/', '>', '<', '==', '<>', '<=', '>=', '~', '!~'];

export const DURATION = ['SECONDS', 'MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'];

const tokenizer = {
  comment: {
    pattern: /(^|[^\\:])\/\/.*/,
    lookbehind: true,
    greedy: true,
  },
  'function-context': {
    pattern: /[a-z0-9_]+\([^)]*\)?/i,
    inside: {},
  },
  duration: {
    pattern: new RegExp(`${DURATION.join('?|')}?`, 'i'),
    alias: 'number',
  },
  builtin: new RegExp(`\\b(?:${functionTokens.map(f => f.text).join('|')})(?=\\s*\\()`, 'i'),
  string: {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: true,
  },
  keyword: new RegExp(`\\b(?:${KEYWORDS.join('|')}|${operatorTokens.map(f => f.text).join('|')}|\\*)\\b`, 'i'),
  boolean: /\b(?:true|false)\b/,
  number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
  operator: /-|\+|\*|\/|>|<|==|<=?|>=?|<>|!~|~|=|\|/,
  punctuation: /[{};(),.:]/,
  variable: /(\[\[(.+?)\]\])|(\$(.+?))\b/,
};

tokenizer['function-context'].inside = {
  argument: {
    pattern: /[a-z0-9_]+(?=:)/i,
    alias: 'symbol',
  },
  duration: tokenizer.duration,
  number: tokenizer.number,
  builtin: tokenizer.builtin,
  string: tokenizer.string,
  variable: tokenizer.variable,
};

// console.log(tokenizer.builtin);

export default tokenizer;

// function escapeRegExp(str: string): string {
//   return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
// }
