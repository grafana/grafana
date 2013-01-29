/*jshint globalstrict:true */
/*global angular:true */
'use strict';

/* NOTE:  This is very much a preview, many things will change. In fact, this
          file will probably go away
*/

/* 
  METAPARAMETERS 

  If you're implementing a panel, these are used by default. You need not handle
  them in your directive.

  span:   The grid is made up of N rows, however there are only 12 columns. Span
          is a number, 1-12
  type:   This is the name of your directive.  
*/

/*
  Histogram

  Draw a histogram of a single query

  NOTE: This will likely be renamed or get a setting that allows for non-time
  based keys. It may also be updated to allow multiple stacked or unstacked
  queries. 

  query:    query to execute
  interval: Bucket size in the standard Nunit (eg 1d, 5m, 30s) Attempts to auto
            scale itself based on timespan
  color:    line/bar color.
  show:     array of what to show, (eg ['bars','lines','points']) 
*/

/* 
  Piequery  

  Use a query facets to compare counts of for different queries, then show them
  on a pie chart

  queries:    An array of queries
  donut:      Make a hole in the middle? 
  tilt:       Tilt the pie in a 3dish way
  legend:     Show it or not?
  colors:     An array of colors to use for slices. These map 1-to-1 with the #
              of queries in your queries array
*/

/* Pieterms

  Use a terms facet to calculate the most popular terms for a field

  query:    Query to perform the facet on
  size:     Limit to this many terms
  exclude:  An array of terms to exclude from the results
  donut:      Make a hole in the middle? 
  tilt:       Tilt the pie in a 3dish way
  legend:     Show it or not?
*/

/* Stackedquery

  Use date histograms to assemble stacked bar or line charts representing 
  multple queries over time

  queries:    An array of queries
  interval:   Bucket size in the standard Nunit (eg 1d, 5m, 30s) Attempts to auto
              scale itself based on timespan
  colors:     An array of colors to use for slices. These map 1-to-1 with the #
              of queries in your queries array
  show:       array of what to show, (eg ['bars','lines','points']) 
*/
angular.module('kibana.panels', [])
