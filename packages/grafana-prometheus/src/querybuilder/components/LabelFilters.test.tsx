// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/LabelFilters.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { select } from 'react-select-event';

import { selectors } from '@grafana/e2e-selectors';

import { getLabelSelects } from '../testUtils';

import { LabelFilters, MISSING_LABEL_FILTER_ERROR_MESSAGE, LabelFiltersProps } from './LabelFilters';

describe('LabelFilters', () => {
  it('truncates list of label names to 1000', async () => {
    const manyMockValues = [...Array(1001).keys()].map((idx: number) => {
      return { label: 'random_label' + idx };
    });

    setup({ onGetLabelNames: jest.fn().mockResolvedValue(manyMockValues) });

    await openLabelNamesSelect();

    await waitFor(() => expect(screen.getAllByTestId(selectors.components.Select.option)).toHaveLength(1000));
  });

  it('renders empty input without labels', async () => {
    setup();
    expect(screen.getAllByText('Select label')).toHaveLength(1);
    expect(screen.getAllByText('Select value')).toHaveLength(1);
    expect(screen.getByText(/=/)).toBeInTheDocument();
    expect(getAddButton()).toBeInTheDocument();
  });

  it('renders multiple labels', async () => {
    setup({
      labelsFilters: [
        { label: 'foo', op: '=', value: 'bar' },
        { label: 'baz', op: '!=', value: 'qux' },
        { label: 'quux', op: '=~', value: 'quuz' },
      ],
    });
    expect(screen.getByText(/foo/)).toBeInTheDocument();
    expect(screen.getByText(/bar/)).toBeInTheDocument();
    expect(screen.getByText(/baz/)).toBeInTheDocument();
    expect(screen.getByText(/qux/)).toBeInTheDocument();
    expect(screen.getByText(/quux/)).toBeInTheDocument();
    expect(screen.getByText(/quuz/)).toBeInTheDocument();
    expect(getAddButton()).toBeInTheDocument();
  });

  it('renders multiple values for regex selectors', async () => {
    setup({
      labelsFilters: [
        { label: 'bar', op: '!~', value: 'baz|bat|bau' },
        { label: 'foo', op: '!~', value: 'fop|for|fos' },
      ],
    });
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
    const { onChange } = setup({ labelsFilters: [{ label: 'foo', op: '=', value: 'bar' }] });
    await userEvent.click(getAddButton());
    expect(screen.getAllByText('Select label')).toHaveLength(1);
    expect(screen.getAllByText('Select value')).toHaveLength(1);
    const { name, value } = getLabelSelects(1);
    await waitFor(() => select(name, 'baz', { container: document.body }));
    await waitFor(() => select(value, 'qux', { container: document.body }));
    expect(onChange).toHaveBeenCalledWith([
      { label: 'foo', op: '=', value: 'bar' },
      { label: 'baz', op: '=', value: 'qux' },
    ]);
  });

  it('removes label', async () => {
    const { onChange } = setup({ labelsFilters: [{ label: 'foo', op: '=', value: 'bar' }] });
    await userEvent.click(screen.getByLabelText(/Remove foo/));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('removes label but preserves a label with a value of empty string', async () => {
    const { onChange } = setup({
      labelsFilters: [
        { label: 'lab', op: '=', value: 'bel' },
        { label: 'foo', op: '=', value: 'bar' },
        { label: 'le', op: '=', value: '' },
      ],
    });
    await userEvent.click(screen.getByLabelText(/Remove foo/));
    expect(onChange).toHaveBeenCalledWith([
      { label: 'lab', op: '=', value: 'bel' },
      { label: 'le', op: '=', value: '' },
    ]);
    expect(screen.queryByText('bar')).toBeNull();
  });

  it('renders empty input when labels are deleted from outside ', async () => {
    const { rerender } = setup({ labelsFilters: [{ label: 'foo', op: '=', value: 'bar' }] });
    expect(screen.getByText(/foo/)).toBeInTheDocument();
    expect(screen.getByText(/bar/)).toBeInTheDocument();
    rerender(
      <LabelFilters
        onChange={jest.fn()}
        onGetLabelNames={jest.fn()}
        getLabelValuesAutofillSuggestions={jest.fn()}
        onGetLabelValues={jest.fn()}
        labelsFilters={[]}
        debounceDuration={300}
      />
    );
    expect(screen.getAllByText('Select label')).toHaveLength(1);
    expect(screen.getAllByText('Select value')).toHaveLength(1);
    expect(screen.getByText(/=/)).toBeInTheDocument();
    expect(getAddButton()).toBeInTheDocument();
  });

  it('does split regex in the middle of a label value when the value contains the char |', () => {
    setup({ labelsFilters: [{ label: 'foo', op: '=~', value: 'boop|par' }] });

    expect(screen.getByText('boop')).toBeInTheDocument();
    expect(screen.getByText('par')).toBeInTheDocument();
  });

  it('does not split regex in between parentheses inside of a label value that contains the char |', () => {
    setup({ labelsFilters: [{ label: 'foo', op: '=~', value: '(b|p)ar' }] });

    expect(screen.getByText('(b|p)ar')).toBeInTheDocument();
  });

  it('shows error when filter with empty strings  and label filter is required', async () => {
    setup({ labelsFilters: [{ label: '', op: '=', value: '' }], labelFilterRequired: true });
    expect(screen.getByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).toBeInTheDocument();
  });

  it('shows error when no filter and label filter is required', async () => {
    setup({ labelsFilters: [], labelFilterRequired: true });
    expect(screen.getByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).toBeInTheDocument();
  });
});

function setup(propOverrides?: Partial<ComponentProps<typeof LabelFilters>>) {
  const defaultProps: LabelFiltersProps = {
    onChange: jest.fn(),
    getLabelValuesAutofillSuggestions: async (query: string, labelName?: string) => [
      { label: 'bar', value: 'bar' },
      { label: 'qux', value: 'qux' },
      { label: 'quux', value: 'quux' },
    ],
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
    debounceDuration: 300,
    labelsFilters: [],
  };

  const props = { ...defaultProps, ...propOverrides };

  const { rerender } = render(<LabelFilters {...props} />);
  return { ...props, rerender };
}

function getAddButton() {
  return screen.getByLabelText(/Add/);
}

async function openLabelNamesSelect() {
  const select = screen.getByText('Select label').parentElement!;
  await userEvent.click(select);
}
