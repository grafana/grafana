import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FIELD_NAME_FACET_KEY } from '@grafana/data';

import { FacetedLabelsFilter, FacetedLabelsFilterProps } from './FacetedLabelsFilter';

function renderFilter(overrides: Partial<FacetedLabelsFilterProps> = {}) {
  const props: FacetedLabelsFilterProps = {
    labels: {
      [FIELD_NAME_FACET_KEY]: ['cpu', 'mem'],
      host: ['a', 'b'],
      region: ['eu', 'us'],
    },
    selected: {},
    onChange: jest.fn(),
    ...overrides,
  };

  return { ...render(<FacetedLabelsFilter {...props} />), onChange: props.onChange as jest.Mock };
}

describe('FacetedLabelsFilter', () => {
  it('returns null when labels are empty', () => {
    const { container } = renderFilter({ labels: {} });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders "By name" section for __name__ facet', () => {
    renderFilter();
    expect(screen.getByText('By name')).toBeInTheDocument();
    expect(screen.getByLabelText('cpu')).toBeInTheDocument();
    expect(screen.getByLabelText('mem')).toBeInTheDocument();
  });

  it('renders "By labels" section with collapsed label groups', () => {
    renderFilter();
    expect(screen.getByText('By labels')).toBeInTheDocument();
    expect(screen.getByText('host')).toBeInTheDocument();
    expect(screen.getByText('region')).toBeInTheDocument();
    expect(screen.queryByLabelText('a')).not.toBeInTheDocument();
  });

  it('omits "By name" section when no __name__ facet exists', () => {
    renderFilter({ labels: { host: ['a', 'b'] } });
    expect(screen.queryByText('By name')).not.toBeInTheDocument();
    expect(screen.getByText('By labels')).toBeInTheDocument();
  });

  it('omits "By labels" section when only __name__ facet exists', () => {
    renderFilter({ labels: { [FIELD_NAME_FACET_KEY]: ['cpu', 'mem'] } });
    expect(screen.getByText('By name')).toBeInTheDocument();
    expect(screen.queryByText('By labels')).not.toBeInTheDocument();
  });

  it('toggles a checkbox value', async () => {
    const { onChange } = renderFilter();
    await userEvent.click(screen.getByLabelText('cpu'));
    expect(onChange).toHaveBeenCalledWith({ [FIELD_NAME_FACET_KEY]: ['cpu'] });
  });

  it('deselects a checkbox value', async () => {
    const { onChange } = renderFilter({
      selected: { [FIELD_NAME_FACET_KEY]: ['cpu', 'mem'] },
    });
    await userEvent.click(screen.getByLabelText('cpu'));
    expect(onChange).toHaveBeenCalledWith({ [FIELD_NAME_FACET_KEY]: ['mem'] });
  });

  it('selects all values for a key', async () => {
    renderFilter();
    const selectButtons = screen.getAllByText('Select all');
    await userEvent.click(selectButtons[0]);
    expect(screen.getAllByText('Select all')[0]).toBeInTheDocument();
  });

  it('shows "Deselect all" when all values are selected', () => {
    renderFilter({
      selected: { [FIELD_NAME_FACET_KEY]: ['cpu', 'mem'] },
    });
    expect(screen.getByText('Deselect all')).toBeInTheDocument();
  });

  it('expands a label group to show its values', async () => {
    renderFilter();
    expect(screen.queryByLabelText('a')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('host'));
    expect(screen.getByLabelText('a')).toBeInTheDocument();
    expect(screen.getByLabelText('b')).toBeInTheDocument();
  });

  it('collapses an expanded label group', async () => {
    renderFilter();
    await userEvent.click(screen.getByText('host'));
    expect(screen.getByLabelText('a')).toBeInTheDocument();
    await userEvent.click(screen.getByText('host'));
    expect(screen.queryByLabelText('a')).not.toBeInTheDocument();
  });

  it('toggles a value in an expanded label group', async () => {
    const { onChange } = renderFilter();
    await userEvent.click(screen.getByText('host'));
    await userEvent.click(screen.getByLabelText('a'));
    expect(onChange).toHaveBeenCalledWith({ host: ['a'] });
  });

  it('shows selected count badge on collapsed label groups', () => {
    renderFilter({ selected: { host: ['a'] } });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('produces a different class name when dimmed', () => {
    const { container: dimmedContainer } = renderFilter({ dimmed: true });
    const { container: normalContainer } = renderFilter({ dimmed: false });
    const dimmedClass = (dimmedContainer.firstChild as HTMLElement).className;
    const normalClass = (normalContainer.firstChild as HTMLElement).className;
    expect(dimmedClass).not.toBe(normalClass);
  });
});
