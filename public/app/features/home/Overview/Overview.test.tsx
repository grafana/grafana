import { render, screen } from 'test/test-utils';

import { Overview } from './Overview';
import { useGuides } from './useGuides';

jest.mock('./useGuides', () => ({
  useGuides: jest.fn(),
}));

const mockUseGuides = jest.mocked(useGuides);

describe('Overview', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGuides.mockReset();
  });

  it("shows 'Get started' in the options while guides are loading", async () => {
    mockUseGuides.mockReturnValue(undefined);

    const { user } = render(<Overview />);

    await user.click(screen.getByRole('button', { name: /all solutions/i }));

    expect(screen.getByRole('menuitem', { name: 'Get started' })).toBeInTheDocument();
  });

  it("hides 'Get started' in the options when no guides are available", async () => {
    mockUseGuides.mockReturnValue([]);

    const { user } = render(<Overview />);

    await user.click(screen.getByRole('button', { name: /all solutions/i }));

    expect(screen.queryByRole('menuitem', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('renders guide skeletons when Get started is selected and loading, then shows guide cards when loaded', async () => {
    const guide = {
      title: 'Set up app monitoring',
      description: 'Visualize traces, metrics, and logs from services you build and run.',
      icon: 'apps' as const,
      color: '#ff780a',
      cta: 'Start setup',
      href: '/a/grafana-app-observability-app/landing',
    };

    mockUseGuides.mockReturnValue(undefined);
    const { user, rerender, container } = render(<Overview />);

    await user.click(screen.getByRole('button', { name: /all solutions/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Get started' }));

    expect(screen.getByText('Recommended getting started guides')).toBeInTheDocument();
    expect(container.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Set up app monitoring' })).not.toBeInTheDocument();

    mockUseGuides.mockReturnValue([guide]);
    rerender(<Overview />);

    expect(screen.getByText('Recommended getting started guides')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up app monitoring' })).toBeInTheDocument();
    expect(screen.getByText('Start setup')).toBeInTheDocument();
  });
});
