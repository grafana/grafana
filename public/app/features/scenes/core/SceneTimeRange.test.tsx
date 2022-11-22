import { SceneTimeRange } from './SceneTimeRange';

describe('SceneTimeRange', () => {
  it('toUrlValues with relative range', () => {
    const timeRange = new SceneTimeRange({ from: 'now-1h', to: 'now' });
    expect(timeRange.urlSync?.getUrlState(timeRange.state)).toEqual(
      new Map([
        ['from', 'now-1h'],
        ['to', 'now'],
      ])
    );
  });

  it('updateFromUrl with ISO time', () => {
    const timeRange = new SceneTimeRange({ from: 'now-1h', to: 'now' });
    timeRange.urlSync?.updateFromUrl(
      new Map([
        ['from', '2021-01-01T10:00:00.000Z'],
        ['to', '2021-02-03T01:20:00.000Z'],
      ])
    );

    expect(timeRange.state.from).toEqual('2021-01-01T10:00:00.000Z');
    expect(timeRange.state.value.from.valueOf()).toEqual(1609495200000);
  });
});
