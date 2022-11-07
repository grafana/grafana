import { AlertState } from '@grafana/data';

import { groupStateByLabels, matchKey } from './StateHistory';

describe('matchKey', () => {
  it('should match with exact string match', () => {
    const groups = ['{ foo=bar, baz=qux }', '{ abc=def, ghi=jkl }'];
    const filter = 'foo=bar';
    const results = groups.filter((group) => matchKey(group, filter));

    expect(results).toStrictEqual([groups[0]]);
  });

  it('should match with regex match', () => {
    const groups = ['{ foo=bar, baz=qux }', '{ abc=def, ghi=jkl }'];
    const filter = '/abc=.*/';
    const results = groups.filter((group) => matchKey(group, filter));

    expect(results).toStrictEqual([groups[1]]);
  });

  it('should match everything with empty filter', () => {
    const groups = ['{ foo=bar, baz=qux }', '{ abc=def, ghi=jkl }'];
    const filter = '';
    const results = groups.filter((group) => matchKey(group, filter));

    expect(results).toStrictEqual(groups);
  });

  it('should match nothing with invalid regex', () => {
    const groups = ['{ foo=bar, baz=qux }', '{ abc=def, ghi=jkl }'];
    const filter = '[';
    const results = groups.filter((group) => matchKey(group, filter));

    expect(results).toStrictEqual([]);
  });
});

describe('groupStateByLabels', () => {
  it('should group a list by labels', () => {
    const history = [
      {
        id: 1,
        newState: AlertState.Alerting,
        updated: 1658834395024,
        text: 'CPU Usage {cpu=0, type=cpu} - Alerting',
        data: {},
      },
      {
        id: 2,
        newState: AlertState.OK,
        updated: 1658834346935,
        text: 'CPU Usage {cpu=1, type=cpu} - Normal',
        data: {},
      },
    ];

    const grouped = groupStateByLabels(history);
    expect(grouped).toMatchSnapshot();
  });

  it('should group a list by labels even if the alert rule name has {}', () => {
    const history = [
      {
        id: 1,
        newState: AlertState.Alerting,
        updated: 1658834395024,
        text: 'CPU Usage {some} {curly stuff} {cpu=0, type=cpu} - Alerting',
        data: {},
      },
      {
        id: 2,
        newState: AlertState.OK,
        updated: 1658834346935,
        text: 'CPU Usage {some} {curly stuff} {cpu=1, type=cpu} - Normal',
        data: {},
      },
    ];

    const grouped = groupStateByLabels(history);
    expect(grouped).toMatchSnapshot();
  });
});
