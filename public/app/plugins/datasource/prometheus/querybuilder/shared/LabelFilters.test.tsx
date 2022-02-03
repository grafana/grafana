import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LabelFilters } from './LabelFilters';
import { QueryBuilderLabelFilter } from './types';
import { getLabelSelects } from '../testUtils';
import { selectOptionInTest } from '../../../../../../../packages/grafana-ui';

describe('LabelFilters', () => {
  it('renders empty input without labels', async () => {
    setup();
    expect(screen.getAllByText(/Choose/)).toHaveLength(2);
    expect(screen.getByText(/=/)).toBeInTheDocument();
    expect(getAddButton()).toBeInTheDocument();
  });

  it('renders multiple labels', async () => {
    setup([
      { label: 'foo', op: '=', value: 'bar' },
      { label: 'baz', op: '!=', value: 'qux' },
      { label: 'quux', op: '=~', value: 'quuz' },
    ]);
    expect(screen.getByText(/foo/)).toBeInTheDocument();
    expect(screen.getByText(/bar/)).toBeInTheDocument();
    expect(screen.getByText(/baz/)).toBeInTheDocument();
    expect(screen.getByText(/qux/)).toBeInTheDocument();
    expect(screen.getByText(/quux/)).toBeInTheDocument();
    expect(screen.getByText(/quuz/)).toBeInTheDocument();
    expect(getAddButton()).toBeInTheDocument();
  });

  it('adds new label', async () => {
    const { onChange } = setup([{ label: 'foo', op: '=', value: 'bar' }]);
    userEvent.click(getAddButton());
    expect(screen.getAllByText(/Choose/)).toHaveLength(2);
    const { name, value } = getLabelSelects(1);
    await selectOptionInTest(name, 'baz');
    await selectOptionInTest(value, 'qux');
    expect(onChange).toBeCalledWith([
      { label: 'foo', op: '=', value: 'bar' },
      { label: 'baz', op: '=', value: 'qux' },
    ]);
  });

  it('removes label', async () => {
    const { onChange } = setup([{ label: 'foo', op: '=', value: 'bar' }]);
    userEvent.click(screen.getByLabelText(/remove/));
    expect(onChange).toBeCalledWith([]);
  });
});

function setup(labels: QueryBuilderLabelFilter[] = []) {
  const props = {
    onChange: jest.fn(),
    onGetLabelNames: async () => ['foo', 'bar', 'baz'],
    onGetLabelValues: async () => ['bar', 'qux', 'quux'],
  };

  render(<LabelFilters {...props} labelsFilters={labels} />);
  return props;
}

function getAddButton() {
  return screen.getByLabelText(/Add/);
}
