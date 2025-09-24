import { fireEvent, render, screen } from '@testing-library/react';

import { config, locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';

import appEvents from '../../../core/app_events';
import { ShowModalReactEvent } from '../../../types/events';

import { GoToSnapshotOriginButton } from './GoToSnapshotOriginButton';

describe('GoToSnapshotOriginButton component', () => {
  beforeEach(async () => {
    locationService.push('/');
    const win: typeof globalThis = window;
    const location = win.location;
    //@ts-ignore
    delete win.location;
    win.location = {
      ...location,
      href: 'http://snapshots.grafana.com/snapshots/dashboard/abcdefghi/my-dash',
    };
    jest.spyOn(appEvents, 'publish');
  });
  config.appUrl = 'http://snapshots.grafana.com/';

  it('renders button and triggers onClick redirects to the original dashboard', () => {
    render(<GoToSnapshotOriginButton originalURL={'/d/c0d2742f-b827-466d-9269-fb34d6af24ff'} />);

    // Check if the button renders with the correct testid
    expect(screen.getByTestId('button-snapshot')).toBeInTheDocument();

    // Simulate a button click
    fireEvent.click(screen.getByTestId('button-snapshot'));

    expect(appEvents.publish).toHaveBeenCalledTimes(0);
    expect(locationService.getLocation().pathname).toEqual('/d/c0d2742f-b827-466d-9269-fb34d6af24ff');
    expect(window.location.href).toBe('http://snapshots.grafana.com/snapshots/dashboard/abcdefghi/my-dash');
  });

  it('renders button and triggers onClick opens a confirmation modal', () => {
    render(<GoToSnapshotOriginButton originalURL={'http://www.anotherdomain.com/'} />);

    // Check if the button renders with the correct testid
    expect(screen.getByTestId('button-snapshot')).toBeInTheDocument();

    // Simulate a button click
    fireEvent.click(screen.getByTestId('button-snapshot'));

    expect(appEvents.publish).toHaveBeenCalledTimes(1);
    expect(appEvents.publish).toHaveBeenCalledWith(
      new ShowModalReactEvent(
        expect.objectContaining({
          component: ConfirmModal,
        })
      )
    );
    expect(locationService.getLocation().pathname).toEqual('/');
    expect(window.location.href).toBe('http://snapshots.grafana.com/snapshots/dashboard/abcdefghi/my-dash');
  });
});
