import { render, screen } from 'test/test-utils';

import { ctaClicked } from '../analytics/main';

import { Guide } from './Guide';

jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
}));

const mockCtaClicked = jest.mocked(ctaClicked);

describe('Guide', () => {
  beforeEach(() => {
    mockCtaClicked.mockClear();
  });

  it('tracks guide card clicks', async () => {
    const { user } = render(
      <Guide
        id="app-monitoring"
        title="Set up app monitoring"
        description="Visualize traces, metrics, and logs from services you build and run."
        icon="apps"
        color="#ff780a"
        cta="Start setup"
        href="#"
      />
    );

    await user.click(screen.getByRole('link', { name: 'Set up app monitoring' }));

    expect(mockCtaClicked).toHaveBeenCalledWith({
      surface: 'overview',
      action: 'open_guide',
      placement: 'card',
      solution: 'app-monitoring',
    });
  });
});
