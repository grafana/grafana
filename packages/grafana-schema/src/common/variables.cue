package common

// Optional formats for the template variable replace functions
// See also https://grafana.com/docs/grafana/latest/dashboards/variables/variable-syntax/#advanced-variable-format-options
VariableFormatID: 
    // Values are lucene escaped and multi-valued variables generate an OR expression
    "lucene" | 
    // Raw values
    "raw" | 
    // Values are regex escaped and multi-valued variables generate a (<value>|<value>) expression
    "regex" | 
    // Values are separated by | character
    "pipe" | 
    // Multiple values are formatted like variable=value
    "distributed" | 
    // Comma seperated values
    "csv" | 
    // HTML escaped
    "html" | 
    // JSON values
    "json" | 
    // Percent encode
    "percentencode" | 
    // Single quote
    "singlequote" | 
    // Double quote
    "doublequote" | 
    // SQL string quoting and commas for use in IN statements and other scenarios
    "sqlstring" | 
    // Date
    "date" | 
    // Format multi-valued variables using glob syntax, example {value1,value2}
    "glob" | 
    // Format variables in their text representation. Example in multi-variable scenario A + B + C.
    "text" | 
    // Format variables as URL parameters. Example in multi-variable scenario A + B + C => var-foo=A&var-foo=B&var-foo=C.
    "queryparam"  @cuetsy(kind="enum",memberNames="Lucene|Raw|Regex|Pipe|Distributed|CSV|HTML|JSON|PercentEncode|SingleQuote|DoubleQuote|SQLString|Date|Glob|Text|QueryParam")