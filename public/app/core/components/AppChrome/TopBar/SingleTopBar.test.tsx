import { KBarProvider } from 'kbar';
import { render, screen } from 'test/test-utils';

import { setAppEvents } from '@grafana/runtime';
import { ModalRoot } from '@grafana/ui';
import appEvents from 'app/core/app_events';

import { SingleTopBar } from './SingleTopBar';

describe('SingleTopBar', () => {
  beforeEach(() => {
    setAppEvents(appEvents);
  });

  it('renders help menu and allows opening keyboard shortcuts modal', async () => {
    const { user } = render(
      <KBarProvider>
        <SingleTopBar
          onToggleKioskMode={() => {}}
          onToggleMegaMenu={() => {}}
          showToolbarLevel={false}
          sectionNav={{
            text: 'Section',
          }}
          pageNav={{
            text: 'Page',
          }}
        />
        <ModalRoot />
      </KBarProvider>,
      {
        preloadedState: {
          navIndex: {
            help: {
              text: 'Help',
              id: 'help',
            },
          },
        },
      }
    );
    expect(screen.getByRole('button', { name: /Open menu/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /help/i }));
    await user.click(await screen.findByText(/keyboard shortcuts/i));
    expect(await screen.findByRole('dialog', { name: /shortcuts/i })).toBeInTheDocument();
  });
});
