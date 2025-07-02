import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { setupMockedDataSource } from '../../../mocks/CloudWatchDataSource';
import { CloudWatchMetricsQuery } from '../../../types';

import { FilterItem } from './FilterItem';

const ds = setupMockedDataSource({
  variables: [],
});

const q: CloudWatchMetricsQuery = {
  id: '',
  region: 'us-east-2',
  namespace: '',
  period: '',
  alias: '',
  metricName: '',
  dimensions: { foo: 'bar', abc: 'xyz' },
  matchExact: true,
  statistic: '',
  expression: '',
  refId: '',
};

describe('Dimensions', () => {
  it('should call getDimensionKeys without the current key', async () => {
    const getDimensionKeys = jest.fn().mockResolvedValue([]);
    ds.datasource.resources.getDimensionKeys = getDimensionKeys;
    const currFilter = { key: 'foo', value: 'bar' };

    render(
      <FilterItem
        metricStat={q}
        datasource={ds.datasource}
        filter={currFilter}
        disableExpressions={true}
        onChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    await userEvent.click(screen.getByLabelText('Dimensions filter key'));
    expect(getDimensionKeys).toHaveBeenCalledWith(
      {
        namespace: q.namespace,
        region: q.region,
        metricName: q.metricName,
        accountId: q.accountId,
        dimensionFilters: { abc: ['xyz'] },
      },
      false
    );
  });
});
