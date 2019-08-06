import { sharedSingleStatMigrationCheck } from './SingleStatBaseOptions';

describe('sharedSingleStatMigrationCheck', () => {
  it('from old valueOptions model without pluginVersion', () => {
    const panel = {
      options: {
        valueOptions: {
          unit: 'watt',
          stat: 'last',
          decimals: 5,
        },
        minValue: 10,
        maxValue: 100,
        valueMappings: [{ type: 1, value: '1', text: 'OK' }],
        thresholds: [
          {
            color: 'green',
            index: 0,
            value: null,
          },
          {
            color: 'orange',
            index: 1,
            value: 40,
          },
          {
            color: 'red',
            index: 2,
            value: 80,
          },
        ],
      },
      title: 'Usage',
      type: 'bargauge',
    };

    expect(sharedSingleStatMigrationCheck(panel as any)).toMatchSnapshot();
  });
});
