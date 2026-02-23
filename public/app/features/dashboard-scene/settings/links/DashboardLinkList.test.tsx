import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DashboardLink } from '@grafana/schema';

import { DashboardLinkList } from './DashboardLinkList';

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

const createMockLink = (overrides: Partial<DashboardLink> = {}): DashboardLink => ({
  title: 'Test Link',
  type: 'link',
  url: 'https://example.com',
  icon: 'external link',
  tags: [],
  asDropdown: false,
  targetBlank: false,
  includeVars: false,
  keepTime: false,
  tooltip: '',
  ...overrides,
});

describe('DashboardLinkList', () => {
  const mockOnNew = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDuplicate = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnOrderChange = jest.fn();

  const defaultProps = {
    onNew: mockOnNew,
    onEdit: mockOnEdit,
    onDuplicate: mockOnDuplicate,
    onDelete: mockOnDelete,
    onOrderChange: mockOnOrderChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('keyboard accessibility', () => {
    it('should have focusable rows with tabIndex', () => {
      const links = [createMockLink({ title: 'Test Link' })];
      render(<DashboardLinkList {...defaultProps} links={links} />);

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1]; // First row is header
      expect(dataRow).toHaveAttribute('tabindex', '0');
    });

    it('should call onEdit when Enter key is pressed on a focused row', async () => {
      const links = [createMockLink({ title: 'Test Link' })];
      const { user } = setup(<DashboardLinkList {...defaultProps} links={links} />);

      const rows = screen.getAllByRole('row');
      rows[1].focus();
      await user.keyboard('{Enter}');

      expect(mockOnEdit).toHaveBeenCalledWith(0);
    });

    it('should call onEdit when Space key is pressed on a focused row', async () => {
      const links = [createMockLink({ title: 'Test Link' })];
      const { user } = setup(<DashboardLinkList {...defaultProps} links={links} />);

      const rows = screen.getAllByRole('row');
      rows[1].focus();
      await user.keyboard(' ');

      expect(mockOnEdit).toHaveBeenCalledWith(0);
    });

    it('should not call onEdit when button inside the row is clicked', async () => {
      const links = [createMockLink({ title: 'Link 1' }), createMockLink({ title: 'Link 2' })];
      const { user } = setup(<DashboardLinkList {...defaultProps} links={links} />);

      // Click a button inside the row - should NOT trigger row's onEdit
      const copyButtons = screen.getAllByRole('button', { name: 'Copy link' });
      await user.click(copyButtons[0]);

      expect(mockOnEdit).not.toHaveBeenCalled();
      expect(mockOnDuplicate).toHaveBeenCalled();
    });
  });
});
