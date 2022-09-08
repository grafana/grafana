import { getDefaultRelativeTimeRange } from '@grafana/data';

import { QueryEditor } from './QueryEditor';

const onChangeMock = jest.fn();
describe('Query Editor', () => {
  it('should maintain the original query time range when duplicating it', () => {
    const query = {
      refId: 'A',
      queryType: '',
      datasourceUid: '',
      model: { refId: 'A', hide: false },
      relativeTimeRange: { from: 100, to: 0 },
    };
    const queryEditor = new QueryEditor({
      onChange: onChangeMock,
      value: [query],
    });

    queryEditor.onDuplicateQuery(query);

    expect(onChangeMock).toHaveBeenCalledWith([
      query,
      { ...query, ...{ refId: 'B', model: { refId: 'B', hide: false } } },
    ]);
  });

  it('should use the default query time range if none is set when duplicating a query', () => {
    const query = {
      refId: 'A',
      queryType: '',
      datasourceUid: '',
      model: { refId: 'A', hide: false },
    };
    const queryEditor = new QueryEditor({
      onChange: onChangeMock,
      value: [query],
    });

    queryEditor.onDuplicateQuery(query);

    const defaultRange = getDefaultRelativeTimeRange();

    expect(onChangeMock).toHaveBeenCalledWith([
      query,
      { ...query, ...{ refId: 'B', relativeTimeRange: defaultRange, model: { refId: 'B', hide: false } } },
    ]);
  });
});
