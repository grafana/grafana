import { http, HttpResponse } from 'msw';
import { createRef } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { locationService, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { GrafanaTemplatesTab } from './GrafanaTemplatesTab';

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

  describe('select mode', () => {
    it('hands the picked template to the caller as Assistant context instead of opening it', async () => {
      const onSelectTemplate = jest.fn();
      const { user } = renderTab({ onSelectTemplate });

      await user.click(await screen.findByRole('button', { name: 'Use template: RED metrics' }));

      expect(onSelectTemplate).toHaveBeenCalledWith({
        id: 'grafana:1',
        title: 'RED metrics',
        kind: 'template_dashboard',
        contextItem: expect.objectContaining({
          type: 'structured',
          hidden: false,
          title: 'RED metrics',
          data: expect.objectContaining({ templateName: 'RED metrics' }),
        }),
      });
      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('renders nothing when there are no templates, to leave the shared grid alone', async () => {
      server.use(http.get('/api/gnet/dashboards', () => HttpResponse.json({ page: 1, pages: 1, items: [] })));
      const { container } = renderTab({ onSelectTemplate: jest.fn() });

      // Skeletons show while loading, then nothing: no empty state taking a card's slot.
      await waitFor(() => expect(container).toBeEmptyDOMElement());
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
    renderTab();

    expect(await screen.findByRole('button', { name: 'View template: RED metrics' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use template: RED metrics' })).not.toBeInTheDocument();
  });
});
