import { render, screen } from '@testing-library/react';
import { type HeaderGroup } from 'react-table';

import { HeaderRow } from './HeaderRow';
import { type TableStyles } from './styles';

describe('HeaderRow', () => {
  describe('aria-labels for sort buttons', () => {
    it('has "Sort by {column}" when column is not sorted', () => {
      const columns = [{ headerText: 'temperature', isSorted: false }];

      setup(columns);

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sort by column temperature');
    });

    it('has "Sort by {column}, ascending" when column is sorted ascending', () => {
      const columns = [
        {
          headerText: 'temperature',
          isSorted: true,
          isSortedDesc: false,
        },
      ];

      setup(columns);

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sort by column temperature, ascending');
    });

    it('has "Sort by {column}, descending" when column is sorted descending', () => {
      const columns = [{ headerText: 'temperature', isSorted: true, isSortedDesc: true }];

      setup(columns);

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sort by column temperature, descending');
    });

    it('uses "Sort column" fallback when header content is not a string', () => {
      const columnWithNonStringHeader = {
        ...createMockColumn({ headerText: 'temperature' }),
        render: () => null,
      };
      const columns = [columnWithNonStringHeader];

      setup(columns);

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sort column');
    });
  });
});
function createMockColumn(columnOverrides: MockColumnOverrides) {
  const { headerText, canSort = true, isSorted = false, isSortedDesc = false } = columnOverrides;

  return {
    getHeaderProps: () => ({ key: `col-${headerText}`, style: {} }),
    getSortByToggleProps: () => ({}),
    render: (key: string) => (key === 'Header' ? headerText : null),
    canSort,
    isSorted,
    isSortedDesc,
  };
}

interface MockColumnOverrides {
  headerText?: string;
  canSort?: boolean;
  isSorted?: boolean;
  isSortedDesc?: boolean;
}

function setup(columns: MockColumnOverrides[]) {
  const mockHeaderGroups = [
    {
      getHeaderGroupProps: () => ({ key: 'hg1' }),
      headers: columns.map(createMockColumn),
    },
  ];
  render(
    // @ts-ignore
    <HeaderRow headerGroups={mockHeaderGroups as HeaderGroup[]} showTypeIcons={true} tableStyles={{} as TableStyles} />
  );
}
