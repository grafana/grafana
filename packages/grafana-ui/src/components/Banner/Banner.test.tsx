import { render, screen, within } from '@testing-library/react';

import { createTheme, type GrafanaTheme2, ThemeContext } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { BannerActionButton } from '../BannerActionButton/BannerActionButton';
import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';
import { LinkButton } from '../LinkButton/LinkButton';
import { Tooltip } from '../Tooltip/Tooltip';

import { Banner } from './Banner';

const withRefresh = (theme: GrafanaTheme2) => {
  theme.flags = { ...theme.flags, visualDesignRefresh: true };
  return theme;
};

const renderWithTheme = (theme: GrafanaTheme2, ui: React.ReactElement) =>
  render(<ThemeContext.Provider value={theme}>{ui}</ThemeContext.Provider>);

describe('Banner', () => {
  describe('variant', () => {
    it.each([
      { variant: 'error', role: 'alert' },
      { variant: 'warning', role: 'alert' },
      { variant: 'info', role: 'status' },
      { variant: 'success', role: 'status' },
    ] as const)('makes a $variant banner a live region with role $role, named by its title', ({ variant, role }) => {
      render(<Banner title="Quota exceeded" variant={variant} />);
      expect(screen.getByRole(role, { name: 'Quota exceeded' })).toBeInTheDocument();
    });

    it('makes a neutral banner, the default, a section landmark named by its title and not a live region', () => {
      render(<Banner title="Try the new editor" />);
      expect(screen.getByRole('region', { name: 'Try the new editor' })).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the role passed in', () => {
      render(<Banner title="Saved" variant="error" role="status" />);
      expect(screen.getByRole('status', { name: 'Saved' })).toBeInTheDocument();
    });

    it('emits the Alert test id for a severity, so that existing e2e tests keep finding it', () => {
      render(<Banner title="Saved" variant="success" />);
      expect(screen.getByTestId(selectors.components.Alert.alertV2('success'))).toBeInTheDocument();
    });

    it('emits the Banner test id for a neutral banner', () => {
      render(<Banner title="Try the new editor" />);
      expect(screen.getByTestId(selectors.components.Banner.container)).toBeInTheDocument();
    });

    it("shows the severity's icon by default, and no icon for a neutral banner", () => {
      render(
        <>
          <Banner title="Quota exceeded" variant="warning" />
          <Banner title="Try the new editor" />
        </>
      );
      expect(screen.getByTestId('icon-exclamation-triangle')).toBeInTheDocument();
      expect(
        within(screen.getByRole('region', { name: 'Try the new editor' })).queryByTestId(/^icon-/)
      ).not.toBeInTheDocument();
    });

    it('shows the icon passed in', () => {
      render(<Banner title="Try the new editor" icon="rocket" />);
      expect(screen.getByTestId('icon-rocket')).toBeInTheDocument();
    });
  });

  describe('colors', () => {
    it("uses the severity's subtle background with the visual refresh", () => {
      const theme = withRefresh(createTheme());
      renderWithTheme(theme, <Banner title="Quota exceeded" variant="warning" />);
      expect(screen.getByTestId(selectors.components.Alert.alertV2('warning'))).toHaveStyle({
        backgroundColor: theme.colors.warning.subtleBackground,
      });
    });

    it("uses the banner.prominent tokens for a prominent banner's background and text", () => {
      const theme = withRefresh(
        createTheme({
          components: { banner: { prominent: { error: { background: 'rgb(1, 2, 3)', text: 'rgb(4, 5, 6)' } } } },
        })
      );
      renderWithTheme(theme, <Banner title="Invoice overdue" variant="error" isProminent />);
      expect(screen.getByTestId(selectors.components.Alert.alertV2('error'))).toHaveStyle({
        backgroundColor: 'rgb(1, 2, 3)',
      });
      expect(screen.getByText('Invoice overdue')).toHaveStyle({ color: 'rgb(4, 5, 6)' });
    });

    it('uses the banner.neutral tokens of the primary theme color by default, with the visual refresh', () => {
      const theme = withRefresh(
        createTheme({ components: { banner: { neutral: { primary: { background: 'rgb(7, 8, 9)' } } } } })
      );
      renderWithTheme(theme, <Banner title="Try the new editor" />);
      expect(screen.getByTestId(selectors.components.Banner.container)).toHaveStyle({
        backgroundColor: 'rgb(7, 8, 9)',
      });
    });

    it('uses the banner.neutral tokens of the theme color passed in, with the visual refresh', () => {
      const theme = withRefresh(
        createTheme({ components: { banner: { neutral: { accent: { text: 'rgb(10, 11, 12)' } } } } })
      );
      renderWithTheme(theme, <Banner title="Try the new editor" themeColor="accent" />);
      expect(screen.getByText('Try the new editor')).toHaveStyle({ color: 'rgb(10, 11, 12)' });
    });

    it("uses the theme color's transparent background without the visual refresh", () => {
      const theme = createTheme();
      renderWithTheme(theme, <Banner title="Try the new editor" themeColor="secondary" />);
      expect(screen.getByTestId(selectors.components.Banner.container)).toHaveStyle({
        backgroundColor: theme.colors.secondary.transparent,
      });
    });

    it('uses custom colors when all four are passed', () => {
      render(
        <Banner
          title="Try the new editor"
          backgroundColor="rgb(20, 21, 22)"
          borderColor="rgb(23, 24, 25)"
          iconColor="rgb(26, 27, 28)"
          textColor="rgb(29, 30, 31)"
        />
      );
      expect(screen.getByTestId(selectors.components.Banner.container)).toHaveStyle({
        backgroundColor: 'rgb(20, 21, 22)',
      });
      expect(screen.getByText('Try the new editor')).toHaveStyle({ color: 'rgb(29, 30, 31)' });
    });
  });

  describe('action', () => {
    it("renders a Button action as a BannerActionButton in the severity's colors", () => {
      render(
        <>
          <Banner title="Quota exceeded" variant="warning" action={<Button variant="primary">Request</Button>} />
          <BannerActionButton severity="warning">Reference</BannerActionButton>
        </>
      );
      expect(screen.getByRole('button', { name: 'Request' })).toHaveClass(
        screen.getByRole('button', { name: 'Reference' }).className
      );
    });

    it('renders a LinkButton inside a Stack as a BannerActionButton link, keeping its href', () => {
      render(
        <>
          <Banner
            title="Quota exceeded"
            variant="info"
            action={
              <Stack>
                <LinkButton href="/docs">Read docs</LinkButton>
              </Stack>
            }
          />
          <BannerActionButton as="a" href="/reference" severity="info">
            Reference
          </BannerActionButton>
        </>
      );
      const link = screen.getByRole('link', { name: 'Read docs' });
      expect(link).toHaveAttribute('href', '/docs');
      expect(link).toHaveClass(screen.getByRole('link', { name: 'Reference' }).className);
    });

    // Tooltip needs its one child as an element, not as an array, so the restyling keeps a single child single.
    it('restyles a Button wrapped in a Tooltip, keeping the Tooltip working', async () => {
      render(
        <>
          <Banner
            title="Preview"
            variant="warning"
            action={
              <Tooltip content="You can't save this dashboard">
                <Button disabled>Save</Button>
              </Tooltip>
            }
          />
          <BannerActionButton severity="warning" disabled>
            Reference
          </BannerActionButton>
        </>
      );
      expect(await screen.findByRole('button', { name: 'Save' })).toHaveClass(
        screen.getByRole('button', { name: 'Reference' }).className
      );
    });

    it("renders a neutral banner's Button action in the theme color's icon color", () => {
      const theme = withRefresh(
        createTheme({ components: { banner: { neutral: { tertiary: { icon: 'rgb(32, 33, 34)' } } } } })
      );
      renderWithTheme(theme, <Banner title="Try it" themeColor="tertiary" action={<Button>Try it now</Button>} />);
      expect(screen.getByRole('button', { name: 'Try it now' })).toHaveStyle({ color: 'rgb(32, 33, 34)' });
    });

    it("keeps an action BannerActionButton's own color in a subtle banner, and replaces it in a prominent one", () => {
      const theme = withRefresh(
        createTheme({ components: { banner: { prominent: { error: { text: 'rgb(35, 36, 37)' } } } } })
      );
      renderWithTheme(
        theme,
        <>
          <Banner
            title="Subtle"
            variant="error"
            action={<BannerActionButton customColor="rgb(38, 39, 40)">Own color</BannerActionButton>}
          />
          <Banner
            title="Prominent"
            variant="error"
            isProminent
            action={<BannerActionButton customColor="rgb(38, 39, 40)">Replaced color</BannerActionButton>}
          />
        </>
      );
      expect(screen.getByRole('button', { name: 'Own color' })).toHaveStyle({ color: 'rgb(38, 39, 40)' });
      expect(screen.getByRole('button', { name: 'Replaced color' })).toHaveStyle({ color: 'rgb(35, 36, 37)' });
    });
  });

  describe('content buttons', () => {
    it("gives a BannerActionButton in the content the banner's colors, replacing its own", () => {
      render(
        <Banner
          title="Try the new editor"
          backgroundColor="rgb(50, 51, 52)"
          borderColor="rgb(53, 54, 55)"
          iconColor="rgb(56, 57, 58)"
          textColor="rgb(59, 60, 61)"
        >
          <p>
            Read more. <BannerActionButton severity="success">Details</BannerActionButton>
          </p>
        </Banner>
      );
      expect(screen.getByRole('button', { name: 'Details' })).toHaveStyle({ color: 'rgb(56, 57, 58)' });
    });

    // Like Trans with interpolation values, this component takes children that React can't render on its own: an
    // object among strings. A real Trans isn't used here, because the i18n extractor would add its key to the locales.
    const Interpolate = ({ children }: { children: Array<string | Record<string, string>> }) => (
      <>{children.map((part) => (typeof part === 'string' ? part : Object.values(part).join(''))).join('')}</>
    );

    it('renders content whose children include interpolation objects, as Trans takes', () => {
      render(
        <Banner title="Behind branch" variant="info">
          <Interpolate>View it in {{ repoType: 'GitHub' }} to see the latest changes.</Interpolate>
        </Banner>
      );
      expect(screen.getByText('View it in GitHub to see the latest changes.')).toBeInTheDocument();
    });

    it('leaves a Button in the content unchanged', () => {
      render(
        <>
          <Banner title="Quota exceeded" variant="warning">
            <Button variant="primary">In content</Button>
          </Banner>
          <Button variant="primary">Reference</Button>
        </>
      );
      expect(screen.getByRole('button', { name: 'In content' })).toHaveClass(
        screen.getByRole('button', { name: 'Reference' }).className
      );
    });
  });
});
