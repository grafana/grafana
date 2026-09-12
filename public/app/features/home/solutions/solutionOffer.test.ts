import { pluginAvailability, setupGuideEnabled } from './pluginAvailability';
import { solutionOffer } from './solutionOffer';

jest.mock('./pluginAvailability', () => ({
  pluginAvailability: jest.fn(),
  setupGuideEnabled: jest.fn(),
}));

const mockPluginAvailability = jest.mocked(pluginAvailability);
const mockSetupGuideEnabled = jest.mocked(setupGuideEnabled);

const spec = (getLearnMore?: () => { href: string }) => ({
  appId: 'example-app',
  description: 'Understand the example signal.',
  setupHint: 'connect an example source',
  setupCta: jest.fn().mockResolvedValue({ label: 'Set up', href: '/setup', action: 'setup' }),
  getLearnMore,
});

beforeEach(() => {
  mockPluginAvailability.mockReset();
  mockPluginAvailability.mockResolvedValue(new Map());
  mockSetupGuideEnabled.mockReset();
  mockSetupGuideEnabled.mockResolvedValue(false);
});

describe('solutionOffer', () => {
  it('does not load plugin availability for an active solution', async () => {
    const definition = spec();
    const offer = solutionOffer(jest.fn().mockResolvedValue('active'), definition);

    await expect(offer()).resolves.toBeNull();
    expect(mockPluginAvailability).not.toHaveBeenCalled();
    expect(definition.setupCta).not.toHaveBeenCalled();
  });

  it('offers an enabled setup path only after a definitive inactive signal', async () => {
    const definition = spec();
    mockPluginAvailability.mockResolvedValue(new Map([['example-app', { state: 'setup' }]]));
    mockSetupGuideEnabled.mockResolvedValue(true);
    const offer = solutionOffer(jest.fn().mockResolvedValue('inactive'), definition);

    await expect(offer()).resolves.toEqual({
      availability: 'setup',
      description: 'Understand the example signal.',
      setupHint: 'connect an example source',
      cta: { label: 'Set up', href: '/setup', action: 'setup' },
    });
    expect(definition.setupCta).toHaveBeenCalledWith({ setupGuideEnabled: true });
  });

  it('keeps the primary CTA and learn-more destination independent', async () => {
    const definition = spec(() => ({ href: 'https://grafana.com/docs/example/' }));
    mockPluginAvailability.mockResolvedValue(new Map([['example-app', { state: 'setup' }]]));
    const offer = solutionOffer(jest.fn().mockResolvedValue('inactive'), definition);

    await expect(offer()).resolves.toEqual({
      availability: 'setup',
      description: 'Understand the example signal.',
      setupHint: 'connect an example source',
      cta: { label: 'Set up', href: '/setup', action: 'setup' },
      learnMore: { href: 'https://grafana.com/docs/example/' },
    });
  });

  it('does not claim setup is needed when detection is inconclusive', async () => {
    const definition = spec();
    mockPluginAvailability.mockResolvedValue(new Map([['example-app', { state: 'setup' }]]));
    const offer = solutionOffer(jest.fn().mockResolvedValue('unknown'), definition);

    await expect(offer()).resolves.toBeNull();
    expect(mockSetupGuideEnabled).not.toHaveBeenCalled();
    expect(definition.setupCta).not.toHaveBeenCalled();
  });

  it('offers enabling a disabled app even when detection is inconclusive', async () => {
    mockPluginAvailability.mockResolvedValue(new Map([['example-app', { state: 'enable' as const, canEnable: true }]]));
    const offer = solutionOffer(
      jest.fn().mockResolvedValue('unknown'),
      spec(() => ({ href: 'https://grafana.com/docs/example/' }))
    );

    await expect(offer()).resolves.toEqual({
      availability: 'enable',
      description: 'Understand the example signal.',
      cta: { label: 'Enable', href: '/plugins/example-app/', action: 'enable' },
      learnMore: { href: 'https://grafana.com/docs/example/' },
    });
  });

  it('keeps a documentation-only offer when no primary setup action is available', async () => {
    const definition = spec(() => ({ href: 'https://grafana.com/docs/example/' }));
    definition.setupCta.mockResolvedValue(null);
    mockPluginAvailability.mockResolvedValue(new Map([['example-app', { state: 'setup' }]]));

    await expect(solutionOffer(jest.fn().mockResolvedValue('inactive'), definition)()).resolves.toEqual({
      availability: 'setup',
      description: 'Understand the example signal.',
      setupHint: 'connect an example source',
      cta: null,
      learnMore: { href: 'https://grafana.com/docs/example/' },
    });
  });

  it('shows a disabled app without an action when the user cannot enable it', async () => {
    mockPluginAvailability.mockResolvedValue(
      new Map([['example-app', { state: 'enable' as const, canEnable: false }]])
    );
    const offer = solutionOffer(jest.fn().mockResolvedValue('inactive'), spec());

    await expect(offer()).resolves.toMatchObject({ availability: 'enable', cta: null });
  });

  it('omits an unavailable app', async () => {
    await expect(solutionOffer(jest.fn().mockResolvedValue('inactive'), spec())()).resolves.toBeNull();
  });

  it('keeps an enabled inactive offer when no destination is available to this user', async () => {
    const definition = spec();
    definition.setupCta.mockResolvedValue(null);
    mockPluginAvailability.mockResolvedValue(new Map([['example-app', { state: 'setup' }]]));

    await expect(solutionOffer(jest.fn().mockResolvedValue('inactive'), definition)()).resolves.toEqual({
      availability: 'setup',
      description: 'Understand the example signal.',
      setupHint: 'connect an example source',
      cta: null,
    });
  });

  it('keeps the classified offer when its CTA fails', async () => {
    const definition = spec();
    mockPluginAvailability.mockResolvedValue(new Map([['example-app', { state: 'setup' }]]));
    definition.setupCta.mockRejectedValue(new Error('setup failed'));

    await expect(solutionOffer(jest.fn().mockResolvedValue('inactive'), definition)()).resolves.toEqual({
      availability: 'setup',
      description: 'Understand the example signal.',
      setupHint: 'connect an example source',
      cta: null,
    });
  });

  it('degrades signal failures to no offer', async () => {
    await expect(solutionOffer(jest.fn().mockRejectedValue(new Error('probe failed')), spec())()).resolves.toBeNull();
  });
});
