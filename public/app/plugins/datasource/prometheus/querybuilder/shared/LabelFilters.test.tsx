import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { getLabelSelects } from '../testUtils';

import { LabelFilters } from './LabelFilters';
import { QueryBuilderLabelFilter } from './types';

describe('LabelFilters', () => {
  it('renders empty input without labels', async () => {
    setup();
    expect(screen.getAllByText('Select label')).toHaveLength(1);
    expect(screen.getAllByText('Select value')).toHaveLength(1);
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

  it('renders multiple values for regex selectors', async () => {
    setup([
      { label: 'bar', op: '!~', value: 'baz|bat|bau' },
      { label: 'foo', op: '!~', value: 'fop|for|fos' },
    ]);
    expect(screen.getByText(/bar/)).toBeInTheDocument();
    expect(screen.getByText(/baz/)).toBeInTheDocument();
    expect(screen.getByText(/bat/)).toBeInTheDocument();
    expect(screen.getByText(/bau/)).toBeInTheDocument();
    expect(screen.getByText(/foo/)).toBeInTheDocument();
    expect(screen.getByText(/for/)).toBeInTheDocument();
    expect(screen.getByText(/fos/)).toBeInTheDocument();
    expect(getAddButton()).toBeInTheDocument();
  });

  it('adds new label', async () => {
    const { onChange } = setup([{ label: 'foo', op: '=', value: 'bar' }]);
    await userEvent.click(getAddButton());
    expect(screen.getAllByText('Select label')).toHaveLength(1);
    expect(screen.getAllByText('Select value')).toHaveLength(1);
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
    await userEvent.click(screen.getByLabelText(/remove/));
    expect(onChange).toBeCalledWith([]);
  });

  it('renders empty input when labels are deleted from outside ', async () => {
    const { rerender } = setup([{ label: 'foo', op: '=', value: 'bar' }]);
    expect(screen.getByText(/foo/)).toBeInTheDocument();
    expect(screen.getByText(/bar/)).toBeInTheDocument();
    rerender(
      <LabelFilters onChange={jest.fn()} onGetLabelNames={jest.fn()} onGetLabelValues={jest.fn()} labelsFilters={[]} />
    );
    expect(screen.getAllByText('Select label')).toHaveLength(1);
    expect(screen.getAllByText('Select value')).toHaveLength(1);
    expect(screen.getByText(/=/)).toBeInTheDocument();
    expect(getAddButton()).toBeInTheDocument();
  });
});

function setup(labels: QueryBuilderLabelFilter[] = []) {
  const props = {
    onChange: jest.fn(),
    onGetLabelNames: async () => [
      { label: 'foo', value: 'foo' },
      { label: 'bar', value: 'bar' },
      { label: 'baz', value: 'baz' },
    ],
    onGetLabelValues: async () => [
      { label: 'bar', value: 'bar' },
      { label: 'qux', value: 'qux' },
      { label: 'quux', value: 'quux' },
    ],
  };

  const { rerender } = render(<LabelFilters {...props} labelsFilters={labels} />);
  return { ...props, rerender };
}

function getAddButton() {
  return screen.getByLabelText(/Add/);
}
