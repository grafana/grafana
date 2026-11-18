import { useEffect } from 'react';
import { act, render, screen } from 'test/test-utils';

import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { type TemplateSelectionProps } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';

import { LOAD_WAIT_MS, LandingTemplates } from './LandingTemplates';

// `undefined` keeps a list loading.
let mockGrafanaCount: number | undefined = 1;
let mockCustomCount: number | undefined = 1;

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab', () => {
  const { useEffect: useMockEffect } = jest.requireActual('react');
  return {
    GrafanaTemplatesTab: ({ onTemplatesLoad }: TemplateSelectionProps) => {
      useMockEffect(() => {
        if (mockGrafanaCount !== undefined) {
          onTemplatesLoad?.(mockGrafanaCount);
        }
      }, [onTemplatesLoad]);
      return (mockGrafanaCount ?? 0) > 0 ? <article data-testid="grafana-card" /> : null;
    },
  };
});

jest.mock(
  'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension',
  () => ({
    getDashboardTemplatesTab: jest.fn(),
  })
);

const mockGetDashboardTemplatesTab = jest.mocked(getDashboardTemplatesTab);
const CustomTemplates = ({ onTemplatesLoad }: TemplateSelectionProps) => {
  useEffect(() => {
    if (mockCustomCount !== undefined) {
      onTemplatesLoad?.(mockCustomCount);
    }
  }, [onTemplatesLoad]);
  return (mockCustomCount ?? 0) > 0 ? <article data-testid="custom-card" /> : null;
};

function renderTemplates(props: Partial<Parameters<typeof LandingTemplates>[0]> = {}) {
  return render(
    <LandingTemplates
      testDataSource={undefined}
      showGrafanaTemplates
      showCustomTemplates
      onSelectTemplate={jest.fn()}
      {...props}
    />
  );
}

describe('LandingTemplates', () => {
  beforeEach(() => {
    mockGrafanaCount = 1;
    mockCustomCount = 1;
    mockGetDashboardTemplatesTab.mockReturnValue(CustomTemplates);
  });

  it('lays out custom templates, then the Grafana ones, in one grid', () => {
    renderTemplates();

    const custom = screen.getByTestId('custom-card');
    const grafana = screen.getByTestId('grafana-card');
    expect(custom.parentElement).toBe(grafana.parentElement);
    expect(custom.compareDocumentPosition(grafana) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('collapses and expands the templates from their header', async () => {
    const { user } = renderTemplates();
    const toggle = screen.getByRole('button', { name: 'Start from a template' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('grafana-card')).not.toBeVisible();

    await user.click(toggle);
    expect(screen.getByTestId('grafana-card')).toBeVisible();
  });

  it('keeps the lists mounted while closed, so reopening does not reload them', async () => {
    const { user } = renderTemplates();
    const card = screen.getByTestId('grafana-card');
    const toggle = screen.getByRole('button', { name: 'Start from a template' });

    await user.click(toggle);
    await user.click(toggle);

    expect(screen.getByTestId('grafana-card')).toBe(card);
  });

  it('holds every card back until all lists have loaded, so they do not reflow', () => {
    mockCustomCount = undefined;
    renderTemplates();

    expect(screen.getByRole('button', { name: 'Start from a template' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('grafana-card')).not.toBeVisible();
  });

  describe('when a list never reports', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('shows the cards that loaded after a short wait', () => {
      mockCustomCount = undefined;
      renderTemplates();
      expect(screen.getByTestId('grafana-card')).not.toBeVisible();

      act(() => jest.advanceTimersByTime(LOAD_WAIT_MS));

      expect(screen.getByTestId('grafana-card')).toBeVisible();
    });

    it('keeps waiting while no list has shown a card, and does not call the panel empty', () => {
      mockCustomCount = undefined;
      mockGrafanaCount = undefined;
      renderTemplates();

      act(() => jest.advanceTimersByTime(LOAD_WAIT_MS));

      expect(screen.getByRole('button', { name: 'Start from a template' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText('No templates available')).not.toBeInTheDocument();
    });
  });

  it('starts closed when no list has templates, and says so when opened', async () => {
    mockGrafanaCount = 0;
    mockCustomCount = 0;
    const { user } = renderTemplates();
    const toggle = screen.getByRole('button', { name: 'Start from a template' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('No templates available')).toBeInTheDocument();
  });

  it('stays open when only one list has templates', () => {
    mockCustomCount = 0;
    renderTemplates();

    expect(screen.getByRole('button', { name: 'Start from a template' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('No templates available')).not.toBeInTheDocument();
  });

  it('leaves out custom templates when they are not available', () => {
    renderTemplates({ showCustomTemplates: false });

    expect(screen.queryByTestId('custom-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('grafana-card')).toBeInTheDocument();
  });

  it('leaves out custom templates when no enterprise list is registered', () => {
    mockGetDashboardTemplatesTab.mockReturnValue(null);
    renderTemplates();

    expect(screen.queryByTestId('custom-card')).not.toBeInTheDocument();
  });
});
