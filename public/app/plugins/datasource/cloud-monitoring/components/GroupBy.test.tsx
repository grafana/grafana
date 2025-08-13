import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openMenu, select } from 'react-select-event';

import { createMockTimeSeriesList } from '../mocks/cloudMonitoringQuery';
import { MetricDescriptor } from '../types/types';

import { GroupBy, Props } from './GroupBy';

const props: Props = {
  onChange: jest.fn(),
  refId: 'refId',
  metricDescriptor: {
    valueType: '',
    metricKind: '',
  } as unknown as MetricDescriptor,
  variableOptionGroup: { options: [] },
  labels: [],
  query: createMockTimeSeriesList(),
};

describe('GroupBy', () => {
  it('renders group by fields', () => {
    render(<GroupBy {...props} />);
    expect(screen.getByLabelText('Group by')).toBeInTheDocument();
    expect(screen.getByLabelText('Group by function')).toBeInTheDocument();
  });

  it('can select a group by', async () => {
    const onChange = jest.fn();
    render(<GroupBy {...props} onChange={onChange} />);

    const groupBy = screen.getByLabelText('Group by');
    const option = 'metadata.system_labels.cloud_account';

    expect(screen.queryByText(option)).not.toBeInTheDocument();
    await openMenu(groupBy);
    expect(screen.getByText(option)).toBeInTheDocument();

    await select(groupBy, option, { container: document.body });
    expect(onChange).toBeCalledWith(expect.objectContaining({ groupBys: expect.arrayContaining([option]) }));
  });

  it('can add a custom group by', async () => {
    const onChange = jest.fn();
    render(<GroupBy {...props} onChange={onChange} />);

    const groupBy = screen.getByLabelText('Group by');
    const option = 'metadata.custom.group_by';

    await openMenu(groupBy);
    expect(screen.queryByText(option)).not.toBeInTheDocument();
    await userEvent.type(groupBy, `${option}{enter}`);

    expect(onChange).toBeCalledWith(expect.objectContaining({ groupBys: expect.arrayContaining([option]) }));
  });
});
