import { toDataFrame } from '@grafana/data/dataframe';

import { getTemplateProxyForField } from './templateProxies';

describe('Template proxies', () => {
  it('supports name and displayName', () => {
    const frames = [
      toDataFrame({
        fields: [
          {
            name: '🔥',
            config: { displayName: '✨' },
            labels: {
              b: 'BBB',
              a: 'AAA',
            },
          },
        ],
      }),
    ];

    const f = getTemplateProxyForField(frames[0].fields[0], frames[0], frames);

    expect(f.name).toEqual('🔥');
    expect(f.displayName).toEqual('✨');
    expect(`${f.labels}`).toEqual('a="AAA", b="BBB"');
    expect(f.labels.__values).toEqual('AAA, BBB');
    expect(f.labels.a).toEqual('AAA');

    // Deprecated syntax
    expect(`${f.formattedLabels}`).toEqual('a="AAA", b="BBB"');
  });
});
