import { render, screen } from '@testing-library/react';

import { fieldReducers, ReducerID } from '@grafana/data';

import { EmptyCell, FooterCell, getFooterValue } from './FooterCell';

describe('FooterCell', () => {
  describe('string value', () => {
    it('renders the string inside a span', () => {
      render(<FooterCell value="Total: 42" />);
      expect(screen.getByText('Total: 42')).toBeInTheDocument();
    });
  });

  describe('array value', () => {
    it('renders each key-value pair as a list item with label and value', () => {
      render(<FooterCell value={[{ Sum: '100' }, { Mean: '20' }]} />);
      expect(screen.getByText('Sum')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Mean')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('renders a single item as a one-row list', () => {
      render(<FooterCell value={[{ Count: '5' }]} />);
      expect(screen.getByText('Count')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('uses only the first key of each item object', () => {
      // Each KeyValue entry is treated as a single label → value pair;
      // only the first key is extracted via Object.keys(v)[0].
      const item = { First: 'win', Second: 'ignored' };
      render(<FooterCell value={[item]} />);
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('win')).toBeInTheDocument();
      expect(screen.queryByText('Second')).not.toBeInTheDocument();
    });

    it('renders an empty cell for an empty array', () => {
      const { container } = render(<FooterCell value={[]} />);
      expect(container.querySelector('span')!.innerHTML).toBe('&nbsp;');
    });
  });

  describe('undefined value', () => {
    it('renders an empty cell for undefined', () => {
      const { container } = render(<FooterCell value={undefined} />);
      expect(container.querySelector('span')!.innerHTML).toBe('&nbsp;');
    });
  });
});

describe('EmptyCell', () => {
  it('renders a span containing a non-breaking space', () => {
    const { container } = render(<EmptyCell />);
    const span = container.querySelector('span');
    expect(span).toBeInTheDocument();
    //   is the non-breaking space character
    expect(span!.innerHTML).toBe('&nbsp;');
  });
});

describe('getFooterValue', () => {
  describe('when footerValues is undefined', () => {
    it('returns the EmptyCell component', () => {
      expect(getFooterValue(0, undefined)).toBe(EmptyCell);
    });
  });

  describe('when isCountRowsSet is true', () => {
    it('returns EmptyCell when the entry at the given index is undefined', () => {
      expect(getFooterValue(5, ['1', '2'], true)).toBe(EmptyCell);
    });

    it('renders the count value labelled with the count reducer display name', () => {
      const countLabel = fieldReducers.get(ReducerID.count).name; // "Count"
      const result = getFooterValue(0, ['42'], true);
      render(result as React.ReactElement);
      expect(screen.getByText(countLabel)).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('converts the footer value to a string before rendering', () => {
      // footerValues entries are typed as FooterItem (string | array | undefined),
      // but count rows stores numeric strings; the implementation casts to String().
      const result = getFooterValue(1, [undefined, '7'], true);
      render(result as React.ReactElement);
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  describe('when isCountRowsSet is false', () => {
    it('passes a string footer value through to FooterCell', () => {
      const result = getFooterValue(0, ['Grand total'], false);
      render(result as React.ReactElement);
      expect(screen.getByText('Grand total')).toBeInTheDocument();
    });

    it('passes an array footer value through to FooterCell', () => {
      const result = getFooterValue(0, [[{ Sum: '99' }]], false);
      render(result as React.ReactElement);
      expect(screen.getByText('Sum')).toBeInTheDocument();
      expect(screen.getByText('99')).toBeInTheDocument();
    });

    it('renders an empty cell when the entry at the given index is undefined', () => {
      // footerValues has only one entry; index 2 is out of bounds.
      const result = getFooterValue(2, [[{ Sum: 'ignored' }]], false);
      const { container } = render(result as React.ReactElement);
      expect(container.querySelector('span')!.innerHTML).toBe('&nbsp;');
    });
  });
});
