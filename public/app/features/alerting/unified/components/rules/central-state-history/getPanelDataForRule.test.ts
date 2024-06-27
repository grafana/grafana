import { dateTime } from '@grafana/data';

import { LogRecord } from '../state-history/common';

import { getPanelDataForRule } from './EventDetails';

const initialTimeStamp = 1000000;
const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' }; // actually, it doesn't matter what is here
const records: LogRecord[] = [
    {
      timestamp: initialTimeStamp,
      line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels , ruleUID: 'ruleUID1', values: { C: 1 } },
    },
    {
        timestamp: initialTimeStamp + 1000,
        line: { previous: 'Alerting', current: 'Normal', labels: instanceLabels, ruleUID: 'ruleUID2' },
        
    },
    {
        timestamp: initialTimeStamp + 2000,
        line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels, ruleUID: 'ruleUID3' },
    },
    // not sorted by timestamp
    {
        timestamp: initialTimeStamp + 4000,
        line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels, ruleUID: 'ruleUID1' , values: { C: 8 }},
    },
    {
        timestamp: initialTimeStamp + 3000,
        line: { previous: 'Alerting', current: 'Normal', labels: instanceLabels, ruleUID: 'ruleUID1' , values: { C: 0 }},
    },
    //duplicate record in the same timestamp
    {
        timestamp: initialTimeStamp + 3000,
        line: { previous: 'Alerting', current: 'Normal', labels: instanceLabels, ruleUID: 'ruleUID1' , values: { C: 0 }},
    },
    {
        timestamp: initialTimeStamp + 5000,
        line: { previous: 'Alerting', current: 'Normal', labels: instanceLabels, ruleUID: 'ruleUID1', values: { C: 0}},
    },
  ];
describe('getPanelDataForRule', () => {
  it('should return correct panel data for a given rule (sorted by time and unique)', () => {

    const result = getPanelDataForRule('ruleUID1', records,'C');

    expect(result.series[0].fields[0].values).toEqual([1000000,1003000,1004000,1005000]);
    expect(result.series[0].fields[1].values).toEqual([1,0,8,0]);
    expect(result.series[0].fields[0].type).toEqual('time');
    expect(result.series[0].fields[1].type).toEqual('number');
    expect(result.state).toEqual('Done');
    expect(result.timeRange.from).toEqual(dateTime(1000000));
    expect(result.timeRange.to).toEqual(dateTime(1005000));

  });

});
