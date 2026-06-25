import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';

import { SplashScreenModal } from './SplashScreenModal';

jest.mock('./useShouldShowSplash', () => ({
  useShouldShowSplash: jest.fn().mockReturnValue({
    shouldShow: true,
    dismiss: jest.fn(),
    markEngaged: jest.fn(),
  }),
}));

jest.mock('./splashContent', () => ({
  getSplashScreenConfig: jest.fn().mockReturnValue({
    version: '11.0.0',
    features: [
      {
        id: 'feature-1',
        icon: 'star',
        badgeText: 'New',
        accentColor: 'primary',
        title: 'Test Feature',
        subtitle: 'Test subtitle',
        bullets: ['Bullet 1'],
        heroImageUrl: '/test-image.png',
      },
    ],
  }),
}));

jest.mock('./SplashScreenSlide', () => ({
  SplashScreenSlide: () => <div data-testid="splash-slide" />,
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    user: { uid: 'u_regularuser' },
    hasRole: jest.fn().mockReturnValue(true),
    hasPermission: jest.fn().mockReturnValue(true),
  },
}));

const mockContextSrv = jest.mocked(contextSrv);

describe('SplashScreenModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextSrv.user.uid = 'u_regularuser';
  });

  it('renders for a regular user', () => {
    render(<SplashScreenModal />);
    expect(screen.getByLabelText("What's new in Grafana")).toBeInTheDocument();
  });

  it('does not render for a service account', () => {
    mockContextSrv.user.uid = 'service-account:8';
    render(<SplashScreenModal />);
    expect(screen.queryByLabelText("What's new in Grafana")).not.toBeInTheDocument();
  });
});
