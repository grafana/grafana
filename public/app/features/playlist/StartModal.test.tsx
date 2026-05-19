import { render, screen } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { type Playlist } from '../../api/clients/playlist/v1';

import { StartModal } from './StartModal';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    ...jest.requireActual('@grafana/runtime').locationService,
    push: jest.fn(),
  },
  reportInteraction: jest.fn(),
}));

const mockPlaylist: Playlist = {
  apiVersion: 'playlist.grafana.app/v1',
  kind: 'Playlist',
  spec: {
    title: 'Test playlist',
    interval: '5m',
    items: [],
  },
  metadata: {
    name: 'test-playlist-uid',
  },
  status: {},
};

function setup() {
  return render(<StartModal playlist={mockPlaylist} onDismiss={jest.fn()} />);
}

describe('StartModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hide logo checkbox', () => {
    it('is not visible in Normal mode', () => {
      setup();
      expect(screen.queryByRole('checkbox', { name: /hide logo/i })).not.toBeInTheDocument();
    });

    it('becomes visible when Kiosk mode is selected', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('radio', { name: /kiosk/i }));
      expect(screen.getByRole('checkbox', { name: /hide logo/i })).toBeInTheDocument();
    });

    it('is hidden again when switching back to Normal mode', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('radio', { name: /kiosk/i }));
      await user.click(screen.getByRole('radio', { name: /normal/i }));
      expect(screen.queryByRole('checkbox', { name: /hide logo/i })).not.toBeInTheDocument();
    });
  });

  describe('when starting the playlist', () => {
    it('includes hideLogo=1 in the URL when Hide logo is checked in kiosk mode', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('radio', { name: /kiosk/i }));
      await user.click(screen.getByRole('checkbox', { name: /hide logo/i }));
      await user.click(screen.getByRole('button', { name: /start/i }));
      expect(locationService.push).toHaveBeenCalledWith(expect.stringContaining('hideLogo=1'));
    });

    it('does not include hideLogo in the URL when Hide logo is not checked', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('radio', { name: /kiosk/i }));
      await user.click(screen.getByRole('button', { name: /start/i }));
      expect(locationService.push).toHaveBeenCalledWith(expect.not.stringContaining('hideLogo'));
    });
  });
});
