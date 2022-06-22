// LOGZIO.GRAFANA CHANGE :: DEV-18135 This file handles the population of elastic query to fit logzio needs
import { isObject } from 'lodash';

function retrieveAggNames(obj: object | string, aggName: string): Array<string | null> {
  const aggNames: Array<string | null> = [];

  function traverseObject(parent: string | null, obj: object | string) {
    if (!isObject(obj)) {
      return;
    }

    if (obj.hasOwnProperty(aggName)) {
      aggNames.push(parent);

      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      traverseObject(key, value);
    }
  }

  traverseObject(null, obj);

  return aggNames;
}

function populateRateAgg(query: any) {
  const queryCopy = Object.assign({}, query);
  const aggNames = retrieveAggNames(queryCopy, 'rate');

  if (aggNames.length > 0) {
    queryCopy.logzio = {
      ...(queryCopy.logzio || {}),
      rate: {},
    };
  }

  return queryCopy;
}

export function populateLogzioQuery(query: any) {
  let queryCopy = Object.assign({}, query);

  queryCopy = populateRateAgg(queryCopy);

  return queryCopy;
}
// LOGZ.IO GRAFANA CHANGE :: end
