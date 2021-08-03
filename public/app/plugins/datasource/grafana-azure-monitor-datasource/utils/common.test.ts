import { hasOption } from './common';

describe('AzureMonitor: hasOption', () => {
  it('can find an option in flat array', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      { value: 'c', label: 'c' },
    ];

    expect(hasOption(options, 'b')).toBeTruthy();
  });

  it('can not find an option in flat array', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      { value: 'c', label: 'c' },
    ];

    expect(hasOption(options, 'not-there')).not.toBeTruthy();
  });

  it('can find an option in a nested group', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      {
        label: 'c',
        value: 'c',
        options: [
          { value: 'c-a', label: 'c-a' },
          { value: 'c-b', label: 'c-b' },
          { value: 'c-c', label: 'c-c' },
        ],
      },
      { value: 'd', label: 'd' },
    ];

    expect(hasOption(options, 'c-b')).toBeTruthy();
  });
});
