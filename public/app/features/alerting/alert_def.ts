///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import {
  QueryPartDef,
  QueryPart,
} from 'app/core/components/query_part/query_part';

var alertQueryDef = new QueryPartDef({
  type: 'query',
  params: [
    {name: "queryRefId", type: 'string', dynamicLookup: true},
    {name: "from", type: "string", options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h']},
    {name: "to", type: "string", options: ['now']},
  ],
  defaultParams: ['#A', '5m', 'now', 'avg']
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

var evalOperators = [
  {text: 'OR', value: 'or'},
  {text: 'AND', value: 'and'},
];

var reducerTypes = [
  {text: 'avg()', value: 'avg'},
  {text: 'min()', value: 'min'},
  {text: 'max()', value: 'max'},
  {text: 'sum()' , value: 'sum'},
  {text: 'count()', value: 'count'},
  {text: 'last()', value: 'last'},
  {text: 'median()', value: 'median'},
];

var noDataModes = [
  {text: 'Alerting', value: 'alerting'},
  {text: 'No Data', value: 'no_data'},
  {text: 'Keep Last State', value: 'keep_state'},
];

var executionErrorModes = [
  {text: 'Alerting', value: 'alerting'},
  {text: 'Keep Last State', value: 'keep_state'},
];

function createReducerPart(model) {
  var def = new QueryPartDef({type: model.type, defaultParams: []});
  return new QueryPart(model, def);
}

function getStateDisplayModel(state) {
  switch (state) {
    case 'ok': {
      return {
        text: 'OK',
        iconClass: 'icon-gf icon-gf-online',
        stateClass: 'alert-state-ok'
      };
    }
    case 'alerting': {
      return {
        text: 'ALERTING',
        iconClass: 'icon-gf icon-gf-critical',
        stateClass: 'alert-state-critical'
      };
    }
    case 'no_data': {
      return {
        text: 'NO DATA',
        iconClass: "fa fa-question",
        stateClass: 'alert-state-warning'
      };
    }
    case 'execution_error': {
      return {
        text: 'EXECUTION ERROR',
        iconClass: 'icon-gf icon-gf-critical',
        stateClass: 'alert-state-critical'
      };
    }

    case 'paused': {
      return {
        text: 'paused',
        iconClass: "fa fa-pause",
        stateClass: 'alert-state-paused'
      };
    }
    case 'pending': {
      return {
        text: 'PENDING',
        iconClass: "fa fa-exclamation",
        stateClass: 'alert-state-warning'
      };
    }
  }
}

function joinEvalMatches(matches, seperator: string) {
  return _.reduce(matches, (res, ev)=> {
    if (ev.Metric !== undefined && ev.Value !== undefined) {
      res.push(ev.Metric + "=" + ev.Value);
    }

    return res;
  }, []).join(seperator);
}

export default {
  alertQueryDef: alertQueryDef,
  getStateDisplayModel: getStateDisplayModel,
  conditionTypes: conditionTypes,
  evalFunctions: evalFunctions,
  evalOperators: evalOperators,
  noDataModes: noDataModes,
  executionErrorModes: executionErrorModes,
  reducerTypes: reducerTypes,
  createReducerPart: createReducerPart,
  joinEvalMatches: joinEvalMatches,
};
