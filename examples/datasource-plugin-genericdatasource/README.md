#Generic backend datasource#

This is a very minimalistic datasource that forwards http requests in a defined format. The idea is that anybody should be able to build an api and retrieve data from any datasource without built-in support in grafana.

Its also serves as an living example implementation of a datasource.

A guide for installing plugins can be found at [placeholder for links].

Your backend need implement 3 urls
 * "/" Should return 200 ok. Used for "Test connection" on the datasource config page.
 * "/search" Used by the find metric options on the query tab in panels
 * "/query" Should return metrics based on input

## Metric discovery ##

### Request ###
```
{ refId: 'F', target: 'select metric' }
```
### Expected Response ###

An array of options based on the target input

####Example####
```
["upper_25","upper_50","upper_75","upper_90","upper_95"]
```

## Metric query ##

### Request ###
```
{
  range: { from: '2015-12-22T03:06:13.851Z',to: '2015-12-22T06:48:24.137Z' },
  interval: '5s',
  targets:
   [ { refId: 'B', target: 'upper_75' },
     { refId: 'A', target: 'upper_90' } ],
  format: 'json',
  maxDataPoints: 2495 //decided by the panel
}
```
### Expected response ###

An array of
```
{
  "target":"target_name",
  "datapoints":[
    [intvalue, timestamp in epoch],
    [intvalue, timestamp in epoch]
  ]
}
```
###Example###
```
[
  {
    "target":"upper_75",
    "datapoints":[
      [622,1450754160000],
      [365,1450754220000]
    ]
  },
  {
    "target":"upper_90",
    "datapoints":[
      [861,1450754160000],
      [767,1450754220000]
    ]
  }
]
```
## Example backend implementation ##
https://gist.github.com/bergquist/bc4aa5baface3cffa109