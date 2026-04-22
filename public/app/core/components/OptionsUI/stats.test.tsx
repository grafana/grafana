import { render } from '@testing-library/react';

import { StatsPickerEditor } from './stats';

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    StatsPicker: jest.fn(() => null),
  };
});

// eslint-disable-next-line import/order -- mock must run before importing StatsPicker from ui
const { StatsPicker } = jest.requireMock('@grafana/ui');

describe('StatsPickerEditor', () => {
  beforeEach(() => {
    jest.mocked(StatsPicker).mockClear();
  });

  it('passes stats, allowMultiple, and defaultStat to StatsPicker', () => {
    const onChange = jest.fn();
    render(
      <StatsPickerEditor
        id="stats-1"
        value={['mean']}
        onChange={onChange}
        item={{ settings: { allowMultiple: true, defaultStat: 'sum' } } as Parameters<typeof StatsPickerEditor>[0]['item']}
        context={{ data: [] }}
      />
    );

    expect(StatsPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stats-1',
        stats: ['mean'],
        onChange,
        allowMultiple: true,
        defaultStat: 'sum',
      }),
      expect.anything()
    );
  });
});
