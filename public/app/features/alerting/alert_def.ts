///<reference path="../../headers/common.d.ts" />

var alertSeverityIconMap = {
  "ok": "icon-gf-online alert-icon-online",
  "warning": "icon-gf-warn alert-icon-warn",
  "critical": "icon-gf-critical alert-icon-critical",
};

function getSeverityIconClass(alertState) {
  return alertSeverityIconMap[alertState];
}

import {
  QueryPartDef,
  QueryPart,
} from 'app/core/components/query_part/query_part';

var alertQueryDef = new QueryPartDef({
  type: 'query',
  params: [
    {name: "queryRefId", type: 'string', options: ['A', 'B', 'C', 'D', 'E', 'F']},
    {name: "from", type: "string", options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h']},
    {name: "to", type: "string", options: ['now']},
  ],
  defaultParams: ['#A', '5m', 'now', 'avg']
});

var reducerAvgDef = new QueryPartDef({
  type: 'avg',
  params: [],
  defaultParams: []
});

var conditionTypes = [
  {text: 'Query', value: 'query'},
];

var evalFunctions = [
  {text: 'IS ABOVE', value: 'gt'},
  {text: 'IS BELOW', value: 'lt'},
  {text: 'IS OUTSIDE RANGE', value: 'outside_range'},
  {text: 'IS WITHIN RANGE', value: 'within_range'},
  {text: 'HAS NO VALUE' , value: 'no_value'}
];

var severityLevels = [
  {text: 'Critical', value: 'critical'},
  {text: 'Warning', value: 'warning'},
];

export default {
  alertQueryDef: alertQueryDef,
  reducerAvgDef: reducerAvgDef,
  getSeverityIconClass: getSeverityIconClass,
  conditionTypes: conditionTypes,
  evalFunctions: evalFunctions,
  severityLevels: severityLevels,
};
