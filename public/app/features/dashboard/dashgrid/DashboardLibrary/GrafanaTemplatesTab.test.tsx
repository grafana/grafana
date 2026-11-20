import { http, HttpResponse } from 'msw';
import { createRef } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { locationService, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { GrafanaTemplatesTab } from './GrafanaTemplatesTab';
import { TemplateDashboardInteractions } from './interactions';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    locationService: {
      ...actual.locationService,
      push: jest.fn(),
      getHistory: () => actual.locationService,
    },
  };
});

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(() => ({ isAvailable: true, openAssistant: jest.fn() })),
  createAssistantContextItem: jest.fn((type: string, data: object) => ({ type, ...data })),
}));

setBackendSrv(backendSrv);
setupMockServer();

const testDataSource = {
  name: 'Test Data Source',
  uid: 'test-data-source-uid',
  type: 'grafana-testdata-datasource',
} as DataSourceInstanceListItem;

function renderTab(props: Partial<Parameters<typeof GrafanaTemplatesTab>[0]> = {}) {
  const loadedFiredRef = createRef<boolean>() as { current: boolean };
  loadedFiredRef.current = true;
  return render(
    <GrafanaTemplatesTab
      entryPoint=""
      testDataSource={testDataSource}
      onClose={jest.fn()}
      loadedFiredRef={loadedFiredRef}
      {...props}
    />
  );
}

describe('GrafanaTemplatesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    server.use(
      http.get('/api/gnet/dashboards', () =>
        HttpResponse.json({
          page: 1,
          pages: 1,
          items: [
            {
              id: 1,
              name: 'RED metrics',
              description: 'Rate, errors and duration',
              slug: 'red-metrics',
              downloads: 10,
              datasource: 'testdata',
            },
          ],
        })
      )
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('select mode', () => {
    it('hands the picked template to the caller as Assistant context instead of opening it', async () => {
      const onSelectTemplate = jest.fn();
      const { user } = renderTab({ onSelectTemplate });

      await user.click(await screen.findByRole('button', { name: 'Use template: RED metrics' }));

      expect(onSelectTemplate).toHaveBeenCalledWith({
        id: 'grafana:1',
        kind: 'template_dashboard',
        url: expect.stringMatching(/^\/dashboard\/template\?.*gnetId=1&.*assistantSource=assistant_button$/),
        contextItem: expect.objectContaining({ title: 'RED metrics' }),
      });
      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('opens the picked template with the entry point of the surface it was picked on', async () => {
      const onSelectTemplate = jest.fn();
      const { user } = renderTab({ onSelectTemplate, entryPoint: 'emptyDashboardPrompt' });

      await user.click(await screen.findByRole('button', { name: 'Use template: RED metrics' }));

      expect(onSelectTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('sourceEntryPoint=empty_dashboard_prompt') })
      );
    });

    it('renders nothing when there are no templates, to leave the shared grid alone', async () => {
      server.use(http.get('/api/gnet/dashboards', () => HttpResponse.json({ page: 1, pages: 1, items: [] })));
      const onTemplatesLoad = jest.fn();
      const { container } = renderTab({ onSelectTemplate: jest.fn(), onTemplatesLoad });

      // Skeletons show while loading, then nothing: no empty state taking a card's slot.
      await waitFor(() => expect(container).toBeEmptyDOMElement());
      expect(onTemplatesLoad).toHaveBeenLastCalledWith(0);
    });

    it('reports how many templates there are before the search, once they load', async () => {
      const onTemplatesLoad = jest.fn();
      renderTab({ onSelectTemplate: jest.fn(), onTemplatesLoad, searchQuery: 'no such template' });

      await waitFor(() => expect(onTemplatesLoad).toHaveBeenCalled());
      // Not while loading: an early 0 would read as an account with no templates.
      expect(onTemplatesLoad).toHaveBeenCalledTimes(1);
      expect(onTemplatesLoad).toHaveBeenCalledWith(1);
      expect(screen.queryByRole('button', { name: /^Use template: / })).not.toBeInTheDocument();
    });

    it('previews the template on its dashboard page in a new tab', async () => {
      const open = jest.spyOn(window, 'open').mockImplementation(() => null);
      const { user } = renderTab({ onSelectTemplate: jest.fn() });

      await user.click(await screen.findByRole('button', { name: 'Preview template: RED metrics' }));

      expect(open).toHaveBeenCalledWith(
        expect.stringMatching(/\/dashboard\/template\?.*gnetId=1/),
        '_blank',
        'noopener,noreferrer'
      );
      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('shows the templates that match the search, sorted as asked', async () => {
      server.use(
        http.get('/api/gnet/dashboards', () =>
          HttpResponse.json({
            page: 1,
            pages: 1,
            items: [
              { id: 1, name: 'RED metrics', description: 'Rate, errors and duration', slug: 'red', downloads: 1 },
              { id: 2, name: 'USE method', description: 'Utilization and saturation', slug: 'use', downloads: 1 },
              { id: 3, name: 'Golden signals', description: 'Latency, traffic, errors', slug: 'gold', downloads: 1 },
            ],
          })
        )
      );
      renderTab({ onSelectTemplate: jest.fn(), searchQuery: 'ERRORS', sortOrder: 'desc' });

      await screen.findByRole('button', { name: 'Use template: RED metrics' });
      const titles = screen
        .getAllByRole('button', { name: /^Use template: / })
        .map((b) => b.getAttribute('aria-label'));
      expect(titles).toEqual(['Use template: RED metrics', 'Use template: Golden signals']);
    });

    it('reports attaching a template as the template modal reports its clicks, placed on the prompt', async () => {
      const itemClicked = jest.spyOn(TemplateDashboardInteractions, 'itemClicked').mockResolvedValue();
      const { user } = renderTab({ onSelectTemplate: jest.fn(), entryPoint: 'emptyDashboardPrompt' });

      await user.click(await screen.findByRole('button', { name: 'Use template: RED metrics' }));

      expect(itemClicked).toHaveBeenCalledWith({
        contentKind: 'template_dashboard',
        datasourceTypes: ['grafana-testdata-datasource'],
        libraryItemId: '1',
        libraryItemTitle: 'RED metrics',
        sourceEntryPoint: 'empty_dashboard_prompt',
        eventLocation: 'empty_dashboard_prompt',
        discoveryMethod: 'browse',
        action: 'attach_template',
      });
    });

    it('does not report taking the attached template off the prompt', async () => {
      const itemClicked = jest.spyOn(TemplateDashboardInteractions, 'itemClicked').mockResolvedValue();
      const onSelectTemplate = jest.fn();
      const { user } = renderTab({ onSelectTemplate, selectedTemplateId: 'grafana:1' });

      await user.click(await screen.findByRole('button', { name: 'Use template: RED metrics' }));

      expect(onSelectTemplate).toHaveBeenCalled();
      expect(itemClicked).not.toHaveBeenCalled();
    });

    it('reports a preview as viewing the template, found by search when one is on', async () => {
      jest.spyOn(window, 'open').mockImplementation(() => null);
      const itemClicked = jest.spyOn(TemplateDashboardInteractions, 'itemClicked').mockResolvedValue();
      const { user } = renderTab({ onSelectTemplate: jest.fn(), searchQuery: 'red' });

      await user.click(await screen.findByRole('button', { name: 'Preview template: RED metrics' }));

      expect(itemClicked).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'view_template', discoveryMethod: 'search' })
      );
    });

    it('marks the selected template', async () => {
      renderTab({ onSelectTemplate: jest.fn(), selectedTemplateId: 'grafana:1' });

      expect(await screen.findByRole('button', { name: 'Use template: RED metrics' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });
  });

  it('opens the template without select mode', async () => {
    const itemClicked = jest.spyOn(TemplateDashboardInteractions, 'itemClicked').mockResolvedValue();
    const { user } = renderTab();

    await user.click(await screen.findByRole('button', { name: 'View template: RED metrics' }));

    expect(itemClicked).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'view_template', eventLocation: 'browse_dashboards_page' })
    );
    expect(locationService.push).toHaveBeenCalledWith(expect.stringMatching(/^\/dashboard\/template\?.*gnetId=1/));
    expect(screen.queryByRole('button', { name: 'Use template: RED metrics' })).not.toBeInTheDocument();
  });
});
