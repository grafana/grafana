import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';

import { createTheme, ThemeContext } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { BannerActionButton } from '../BannerActionButton/BannerActionButton';

import { AlertBanner } from './AlertBanner';

describe('AlertBanner', () => {
  it('sets the accessible label correctly based on the title if there is no aria-label set', () => {
    render(<AlertBanner title="Uh oh spagghettios!" />);
    expect(screen.getByRole('alert', { name: 'Uh oh spagghettios!' })).toBeInTheDocument();
  });

  it('prefers the aria-label attribute over the title if it is set', () => {
    render(<AlertBanner title="Uh oh spagghettios!" aria-label="A fancy label" />);
    expect(screen.queryByRole('alert', { name: 'Uh oh spagghettios!' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert', { name: 'A fancy label' })).toBeInTheDocument();
  });

  it('infers the role based on the severity in case it is not set manually', () => {
    render(<AlertBanner title="Error message" severity="error" />);
    expect(screen.getByRole('alert', { name: 'Error message' })).toBeInTheDocument();

    render(<AlertBanner title="Warning message" severity="warning" />);
    expect(screen.getByRole('alert', { name: 'Warning message' })).toBeInTheDocument();

    render(<AlertBanner title="Success message" severity="success" />);
    expect(screen.getByRole('status', { name: 'Success message' })).toBeInTheDocument();

    render(<AlertBanner title="Info message" severity="info" />);
    expect(screen.getByRole('status', { name: 'Info message' })).toBeInTheDocument();
  });

  it('is possible to set the role manually', () => {
    render(<AlertBanner title="Error message" severity="error" role="status" />);
    expect(screen.queryByRole('alert', { name: 'Error message' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Error message' })).toBeInTheDocument();
  });

  it('keeps the severity test id when a custom data-testid is passed', () => {
    render(<AlertBanner title="Warning message" severity="warning" data-testid="custom-id" />);
    const alert = screen.getByRole('alert', { name: 'Warning message' });
    expect(screen.getByTestId('custom-id')).toBe(alert);
    expect(alert).toContainElement(screen.getByTestId(selectors.components.Alert.alertV2('warning')));
  });

  describe('action prop', () => {
    it.each(['error', 'warning', 'info', 'success'] as const)(
      "renders the action of a %s alert banner as a BannerActionButton in the banner's text color",
      (severity) => {
        const theme = createTheme();
        render(
          <ThemeContext.Provider value={theme}>
            <AlertBanner title="Test" severity={severity} action={{ onClick: jest.fn() }} actionLabel="Action" />
            <BannerActionButton customColor={theme.colors[severity].contrastText}>Reference</BannerActionButton>
          </ThemeContext.Provider>
        );
        expect(screen.getByRole('button', { name: 'Action' })).toHaveClass(
          screen.getByRole('button', { name: 'Reference' }).className
        );
      }
    );

    it('renders the action as a link when action has as="a" and an href', () => {
      render(
        <AlertBanner
          title="Test"
          severity="warning"
          action={{ as: 'a', href: 'https://grafana.com/billing', target: '_blank' }}
          actionLabel="View invoice"
        />
      );
      const link = screen.getByRole('link', { name: 'View invoice' });
      expect(link).toHaveAttribute('href', 'https://grafana.com/billing');
      expect(link).toHaveAttribute('target', '_blank');
      expect(screen.queryByRole('button', { name: 'View invoice' })).not.toBeInTheDocument();
    });

    it('renders no action button when action is not set', () => {
      render(<AlertBanner title="Quota exceeded" severity="warning" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders both the action button and the dismiss button when onRemove is also set', () => {
      render(
        <AlertBanner
          title="Quota exceeded"
          severity="warning"
          action={{ onClick: jest.fn() }}
          actionLabel="Request increase"
          onRemove={jest.fn()}
        />
      );
      expect(screen.getByRole('button', { name: 'Request increase' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument();
    });

    it('calls the action handler when the action button is clicked', async () => {
      const user = userEvent.setup();
      const onAction = jest.fn();
      render(<AlertBanner title="Test" severity="info" action={{ onClick: onAction }} actionLabel="Do action" />);
      await user.click(screen.getByRole('button', { name: 'Do action' }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  it("uses the theme's alertBanner background token for its background", () => {
    const theme = createTheme({ components: { alertBanner: { warning: { background: 'rgb(106, 79, 14)' } } } });
    render(
      <ThemeContext.Provider value={theme}>
        <AlertBanner title="Quota exceeded" severity="warning" />
      </ThemeContext.Provider>
    );
    expect(screen.getByTestId(selectors.components.Alert.alertV2('warning'))).toHaveStyle({
      backgroundColor: 'rgb(106, 79, 14)',
    });
  });

  it("uses the theme's alertBanner iconBoxBackground token for the tile behind its icon", () => {
    const theme = createTheme({ components: { alertBanner: { warning: { iconBoxBackground: 'rgb(212, 164, 74)' } } } });
    theme.flags = { ...theme.flags, visualDesignRefresh: true };
    render(
      <ThemeContext.Provider value={theme}>
        <AlertBanner title="Quota exceeded" severity="warning" />
      </ThemeContext.Provider>
    );
    expect(screen.getByTestId('icon-exclamation-triangle').parentElement).toHaveStyle({
      backgroundColor: 'rgb(212, 164, 74)',
    });
  });

  it("uses the theme's alertBanner border token for its border with the visual refresh flag on", () => {
    const theme = createTheme({ components: { alertBanner: { warning: { border: 'rgb(4, 5, 6)' } } } });
    theme.flags = { ...theme.flags, visualDesignRefresh: true };
    render(
      <ThemeContext.Provider value={theme}>
        <AlertBanner title="Quota exceeded" severity="warning" />
      </ThemeContext.Provider>
    );
    expect(screen.getByTestId(selectors.components.Alert.alertV2('warning'))).toHaveStyle({
      borderColor: 'rgb(4, 5, 6)',
    });
  });

  it("uses the theme's alertBanner text token for its text and action", () => {
    const theme = createTheme({ components: { alertBanner: { error: { text: 'rgb(1, 2, 3)' } } } });
    render(
      <ThemeContext.Provider value={theme}>
        <AlertBanner title="Quota exceeded" severity="error" action={{ onClick: jest.fn() }} actionLabel="Upgrade" />
      </ThemeContext.Provider>
    );
    expect(screen.getByText('Quota exceeded')).toHaveStyle({ color: 'rgb(1, 2, 3)' });
    expect(screen.getByRole('button', { name: 'Upgrade' })).toHaveStyle({ color: 'rgb(1, 2, 3)' });
  });

  // Grafana sets the visual refresh flag on every theme, including ones that keep the default background.
  it("keeps the severity's contrast text with the visual refresh flag on and the default tokens", () => {
    const theme = createTheme({ colors: { mode: 'dark' } });
    theme.flags = { ...theme.flags, visualDesignRefresh: true };
    render(
      <ThemeContext.Provider value={theme}>
        <AlertBanner title="Quota exceeded" severity="warning" />
      </ThemeContext.Provider>
    );
    expect(screen.getByText('Quota exceeded')).toHaveStyle({ color: theme.colors.warning.contrastText });
  });

  describe('BannerActionButton children', () => {
    const renderWithTextToken = (ui: ReactElement) => {
      const theme = createTheme({ components: { alertBanner: { error: { text: 'rgb(1, 2, 3)' } } } });
      return render(<ThemeContext.Provider value={theme}>{ui}</ThemeContext.Provider>);
    };

    it('gives a BannerActionButton child the color of the action button', () => {
      renderWithTextToken(
        <AlertBanner title="Quota exceeded" severity="error">
          <BannerActionButton>Upgrade</BannerActionButton>
        </AlertBanner>
      );
      expect(screen.getByRole('button', { name: 'Upgrade' })).toHaveStyle({ color: 'rgb(1, 2, 3)' });
    });

    it('gives a nested BannerActionButton the color of the action button', () => {
      renderWithTextToken(
        <AlertBanner title="Quota exceeded" severity="error">
          <p>
            Your stack has stopped ingesting data. <BannerActionButton>Upgrade</BannerActionButton>
          </p>
        </AlertBanner>
      );
      expect(screen.getByRole('button', { name: 'Upgrade' })).toHaveStyle({ color: 'rgb(1, 2, 3)' });
      expect(screen.getByText(/Your stack has stopped ingesting data/)).toBeInTheDocument();
    });

    it("replaces a BannerActionButton child's own severity", () => {
      renderWithTextToken(
        <AlertBanner title="Quota exceeded" severity="error">
          <BannerActionButton severity="success">Upgrade</BannerActionButton>
        </AlertBanner>
      );
      expect(screen.getByRole('button', { name: 'Upgrade' })).toHaveStyle({ color: 'rgb(1, 2, 3)' });
    });
  });

  describe('icon and loading state', () => {
    it('shows the icon for the severity by default', () => {
      render(<AlertBanner title="Test" severity="error" />);
      expect(screen.getByTestId('icon-exclamation-circle')).toBeInTheDocument();
    });

    it('shows a custom icon when icon is set', () => {
      render(<AlertBanner title="Test" severity="info" icon="ai-sparkle" />);
      expect(screen.getByTestId('icon-ai-sparkle')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-info-circle')).not.toBeInTheDocument();
    });

    it('replaces the icon with a spinner and hides the dismiss X icon when isLoading is set', () => {
      render(<AlertBanner title="Test" severity="info" isLoading onRemove={jest.fn()} />);
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-info-circle')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
    });

    it('hides the buttonContent dismiss button when isLoading is set', () => {
      render(<AlertBanner title="Test" severity="info" isLoading onRemove={jest.fn()} buttonContent="Not now" />);
      expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument();
    });
  });

  it('passes isCompact to the banner, which reduces its padding', () => {
    render(<AlertBanner title="Test" severity="info" isCompact />);
    expect(screen.getByTestId(selectors.components.Alert.alertV2('info'))).toHaveStyle({ padding: '4px 12px' });
  });

  describe('button accessible names and onRemove', () => {
    it.each(['error', 'warning', 'info', 'success'] as const)(
      'wraps buttonContent of a %s alert banner in a single dismiss button that calls onRemove',
      async (severity) => {
        const user = userEvent.setup();
        const onRemove = jest.fn();
        render(<AlertBanner title="Test" severity={severity} buttonContent="Dismiss" onRemove={onRemove} />);
        expect(screen.getAllByRole('button')).toHaveLength(1);
        await user.click(screen.getByRole('button', { name: 'Dismiss' }));
        expect(onRemove).toHaveBeenCalledTimes(1);
      }
    );

    it('uses visible string buttonContent as the accessible name', () => {
      render(<AlertBanner title="Test" buttonContent="Go back" onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
    });

    it('uses visible element buttonContent as the accessible name', () => {
      render(<AlertBanner title="Test" buttonContent={<span>Go back</span>} onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
    });

    it('renders dismiss X icon when only onRemove is set and announces as Close alert', () => {
      render(<AlertBanner title="Test" onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument();
    });

    it('calls onRemove when the dismiss X icon is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = jest.fn();
      render(<AlertBanner title="Test" onRemove={onRemove} />);
      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
