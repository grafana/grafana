import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Breadcrumbs } from './Breadcrumbs';
import { type Breadcrumb } from './types';

const mockBreadcrumbs: Breadcrumb[] = [
  { text: 'Home', href: '/home' },
  { text: 'First', href: '/first' },
  { text: 'Second', href: '/second' },
];

describe('Breadcrumbs', () => {
  beforeEach(() => {
    const rect = document.body.getBoundingClientRect();
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ ...rect, width: 100 });
    const createRange = document.createRange.bind(document);
    jest.spyOn(document, 'createRange').mockImplementation(() => {
      const range = createRange();
      range.getBoundingClientRect = () => ({ ...rect, width: 100 });
      return range;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render without error', () => {
    expect(() => render(<Breadcrumbs breadcrumbs={[]} />)).not.toThrow();
  });

  it('should render a <nav> element', () => {
    render(<Breadcrumbs breadcrumbs={[]} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should render links for each breadcrumb except the last', () => {
    render(<Breadcrumbs breadcrumbs={mockBreadcrumbs} />);
    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links.length).toEqual(2);
    const homeLink = within(nav).getByRole('link', { name: 'Home' });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/home');
    const firstLink = within(nav).getByRole('link', { name: 'First' });
    expect(firstLink).toBeInTheDocument();
    expect(firstLink).toHaveAttribute('href', '/first');
  });

  it('should render the last breadcrumb as text and set the correct aria-current attribute', () => {
    render(<Breadcrumbs breadcrumbs={mockBreadcrumbs} />);
    const nav = screen.getByRole('navigation');
    expect(within(nav).queryByRole('link', { name: 'Second' })).not.toBeInTheDocument();
    expect(within(nav).getByText('Second')).toBeInTheDocument();
    expect(within(nav).getByText('Second')).toHaveAttribute('aria-current', 'page');
  });

  it.each(['Home', 'Second'])('shows the full label for %s in a tooltip on hover', async (text) => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    const user = userEvent.setup();
    render(<Breadcrumbs breadcrumbs={mockBreadcrumbs} />);
    const breadcrumb = within(screen.getByRole('navigation')).getByText(text);

    await user.hover(breadcrumb);

    expect(screen.getByRole('tooltip')).toHaveTextContent(text);
    expect(breadcrumb).not.toHaveAttribute('title');

    await user.unhover(breadcrumb);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it.each(['Home', 'Second'])('does not show a tooltip for %s when the full label fits', async (text) => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    const user = userEvent.setup();
    render(<Breadcrumbs breadcrumbs={mockBreadcrumbs} />);
    const breadcrumb = within(screen.getByRole('navigation')).getByText(text);

    await user.hover(breadcrumb);

    expect(breadcrumb).toHaveTextContent(text);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it.each(['Home', 'Second'])(
    'shows a tooltip for %s when fractional overflow rounds to equal widths',
    async (text) => {
      jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(81);
      jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(81);
      const rect = document.body.getBoundingClientRect();
      jest.mocked(Element.prototype.getBoundingClientRect).mockReturnValue({ ...rect, width: 80.8671875 });
      const range = document.createRange();
      range.getBoundingClientRect = () => ({ ...rect, width: 81.1015625 });
      jest.mocked(document.createRange).mockReturnValue(range);
      const user = userEvent.setup();
      render(<Breadcrumbs breadcrumbs={mockBreadcrumbs} />);

      await user.hover(within(screen.getByRole('navigation')).getByText(text));

      expect(screen.getByRole('tooltip')).toHaveTextContent(text);
    }
  );

  it('updates tooltip visibility when the breadcrumb resizes', async () => {
    const clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    const resizeCallbacks: Array<() => void> = [];
    jest.spyOn(window, 'ResizeObserver').mockImplementation((callback) => {
      const observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
      resizeCallbacks.push(() => callback([], observer));
      return observer;
    });
    const user = userEvent.setup();
    render(<Breadcrumbs breadcrumbs={[{ text: 'Dashboard', href: '/dashboard' }]} />);
    const breadcrumb = screen.getByText('Dashboard');

    await user.hover(breadcrumb);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Dashboard');

    clientWidth.mockReturnValue(200);
    act(() => resizeCallbacks[0]());
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.unhover(breadcrumb);
    clientWidth.mockReturnValue(100);
    act(() => resizeCallbacks[0]());
    await user.hover(breadcrumb);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Dashboard');
  });

  it('checks truncation again when the label changes', async () => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    const scrollWidth = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    const user = userEvent.setup();
    const { rerender } = render(<Breadcrumbs breadcrumbs={[{ text: 'Short', href: '/dashboard' }]} />);

    scrollWidth.mockReturnValue(200);
    rerender(<Breadcrumbs breadcrumbs={[{ text: 'A longer dashboard title', href: '/dashboard' }]} />);

    await user.tab();

    expect(screen.getByRole('tooltip')).toHaveTextContent('A longer dashboard title');
    expect(screen.getByText('A longer dashboard title', { selector: 'span' })).toHaveFocus();
  });

  it('checks truncation again when the current breadcrumb becomes a link', async () => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    const scrollWidth = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    const user = userEvent.setup();
    const { rerender } = render(<Breadcrumbs breadcrumbs={[{ text: 'Dashboard', href: '/dashboard' }]} />);

    scrollWidth.mockReturnValue(200);
    rerender(
      <Breadcrumbs
        breadcrumbs={[
          { text: 'Dashboard', href: '/dashboard' },
          { text: 'Settings', href: '/dashboard/settings' },
        ]}
      />
    );

    await user.hover(screen.getByRole('link', { name: 'Dashboard' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Dashboard');
  });
});
