import { type ChatContextItem, createAssistantContextItem } from '@grafana/assistant';

import { DashboardScene } from '../DashboardScene';

import { buildLandingPageRequest, buildRestyleTabRequest } from './customPanelAssistant';

describe('Custom panel Assistant requests', () => {
  beforeEach(() => {
    jest
      .mocked(createAssistantContextItem)
      .mockImplementation((type, params) => ({ type, params }) as unknown as ChatContextItem);
  });

  afterEach(() => {
    jest.mocked(createAssistantContextItem).mockReset();
  });

  it('asks for a landing page with the dashboard as context', () => {
    const dashboard = new DashboardScene({
      uid: 'abc',
      title: 'Checkout',
      meta: { folderUid: 'f1', folderTitle: 'Shop' },
    });

    expect(buildLandingPageRequest(dashboard)).toEqual({
      origin: 'grafana/dashboards/custom-panel-landing',
      mode: 'dashboarding',
      prompt: 'Create a landing page for this dashboard.',
      context: [expect.objectContaining({ params: expect.anything() })],
      autoSend: true,
    });
    expect(createAssistantContextItem).toHaveBeenCalledWith('dashboard', {
      dashboardUid: 'abc',
      dashboardTitle: 'Checkout',
      folderUid: 'f1',
      folderTitle: 'Shop',
    });
  });

  it('names the tab to restyle, and leaves the context out for a dashboard that was never saved', () => {
    const request = buildRestyleTabRequest(new DashboardScene({ title: 'New dashboard' }), 'Latency');

    expect(request).toEqual(
      expect.objectContaining({
        origin: 'grafana/dashboards/custom-panel-landing',
        prompt: 'Restyle the Latency tab of this dashboard.',
        context: [],
      })
    );
    expect(createAssistantContextItem).not.toHaveBeenCalled();
  });
});
