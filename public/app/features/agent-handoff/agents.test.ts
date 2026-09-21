import { canOpenPanelInAgent, hasSeenAgentSetup, markAgentSetupSeen } from './agents';

describe('canOpenPanelInAgent', () => {
  it('offers the handoff for the panel types the viewer can draw', () => {
    expect(canOpenPanelInAgent('timeseries')).toBe(true);
  });

  it.each(['table', 'stat', 'geomap', 'text'])(
    'does not offer it for %s, which would arrive unrenderable',
    (pluginId) => {
      expect(canOpenPanelInAgent(pluginId)).toBe(false);
    }
  );

  it('does not offer it for a panel whose plugin has not resolved yet', () => {
    expect(canOpenPanelInAgent(undefined)).toBe(false);
  });
});

describe('agent setup state', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reports an agent as not set up until it has been', () => {
    expect(hasSeenAgentSetup('cursor')).toBe(false);

    markAgentSetupSeen('cursor');

    expect(hasSeenAgentSetup('cursor')).toBe(true);
  });

  it('tracks each agent separately, so setting one up does not vouch for the other', () => {
    markAgentSetupSeen('claude');

    expect(hasSeenAgentSetup('claude')).toBe(true);
    expect(hasSeenAgentSetup('cursor')).toBe(false);
  });
});
