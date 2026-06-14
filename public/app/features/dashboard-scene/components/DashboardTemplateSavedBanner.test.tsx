import { render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { getDashboardTemplateExtension } from '../settings/enterprise-components/DashboardTemplateExtension';

import { DashboardTemplateSavedBanner } from './DashboardTemplateSavedBanner';

jest.mock('../settings/enterprise-components/DashboardTemplateExtension', () => ({
  getDashboardTemplateExtension: jest.fn(),
}));

const mockGetExtension = jest.mocked(getDashboardTemplateExtension);

function mockLoadTemplate(title: string | undefined) {
  mockGetExtension.mockReturnValue({
    loadTemplate: jest.fn().mockResolvedValue({
      kind: 'DashboardTemplate',
      apiVersion: 'v1alpha1',
      metadata: { name: 'tmpl-1' },
      spec: { title, description: '', tags: [], dashboardVersion: '1', dashboard: {} },
    }),
    listHistory: jest
      .fn()
      .mockResolvedValue({ kind: '', apiVersion: '', metadata: { resourceVersion: '0' }, items: [] }),
    restore: jest.fn().mockResolvedValue(false),
  });
}

describe('DashboardTemplateSavedBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadTemplate('Saved Template Name');
  });

  it('renders when templateSaved URL param is present and the template title resolves', async () => {
    render(<DashboardTemplateSavedBanner />, {
      historyOptions: { initialEntries: ['/dashboard?templateSaved=tmpl-1'] },
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Template created');
    expect(await screen.findByText(/Saved Template Name/)).toBeInTheDocument();
  });

  it('does not render when templateSaved param is missing', async () => {
    render(<DashboardTemplateSavedBanner />, {
      historyOptions: { initialEntries: ['/dashboard'] },
    });

    await waitFor(() => {
      expect(screen.queryByText('Template created')).not.toBeInTheDocument();
    });
  });

  it('does not render when editview URL param is set', async () => {
    render(<DashboardTemplateSavedBanner />, {
      historyOptions: { initialEntries: ['/dashboard?templateSaved=tmpl-1&editview=settings'] },
    });

    await waitFor(() => {
      expect(screen.queryByText('Template created')).not.toBeInTheDocument();
    });
  });

  it('does not render until the template title is loaded', async () => {
    mockLoadTemplate(undefined);
    render(<DashboardTemplateSavedBanner />, {
      historyOptions: { initialEntries: ['/dashboard?templateSaved=tmpl-1'] },
    });

    await waitFor(() => {
      expect(screen.queryByText('Template created')).not.toBeInTheDocument();
    });
  });

  it('clears the templateSaved URL param when dismissed', async () => {
    const { user } = render(<DashboardTemplateSavedBanner />, {
      historyOptions: { initialEntries: ['/dashboard?templateSaved=tmpl-1'] },
    });

    await screen.findByText('Template created');
    await user.click(screen.getByRole('button', { name: /Close alert/i }));

    await waitFor(() => {
      expect(locationService.getLocation().search).not.toContain('templateSaved=tmpl-1');
    });
  });

  it('adds templateDashboards=true to the URL when the gallery link is clicked', async () => {
    const { user } = render(<DashboardTemplateSavedBanner />, {
      historyOptions: { initialEntries: ['/dashboard?templateSaved=tmpl-1'] },
    });

    await screen.findByText('Template created');
    await user.click(screen.getByRole('link', { name: /template gallery/i }));

    await waitFor(() => {
      expect(locationService.getLocation().search).toContain('templateDashboards=true');
    });
  });
});
