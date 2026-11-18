import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BreadcrumbItem } from './BreadcrumbItem';
import { useBreadcrumbTruncation } from './useBreadcrumbTruncation';

jest.mock('./useBreadcrumbTruncation');

describe('BreadcrumbItem', () => {
  it('shows a tooltip only for a truncated breadcrumb', async () => {
    jest.mocked(useBreadcrumbTruncation).mockImplementation((text) => ({
      breadcrumbRef: { current: null },
      isTruncated: text === 'Long dashboard title',
    }));
    const user = userEvent.setup();
    render(
      <>
        <ul>
          <BreadcrumbItem text="Long dashboard title" href="/dashboard" isCurrent={false} index={0} flexGrow={10} />
          <BreadcrumbItem text="Settings" href="/dashboard/settings" isCurrent={true} index={1} flexGrow={10} />
        </ul>
        <button>Next</button>
      </>
    );

    const truncatedBreadcrumb = screen.getByRole('link', { name: 'Long dashboard title' });
    await user.hover(truncatedBreadcrumb);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Long dashboard title');
    expect(truncatedBreadcrumb).not.toHaveAttribute('title');

    await user.unhover(truncatedBreadcrumb);
    const fullBreadcrumb = screen.getByText('Settings');
    await user.hover(fullBreadcrumb);
    expect(fullBreadcrumb).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.tab();
    expect(truncatedBreadcrumb).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
  });
});
