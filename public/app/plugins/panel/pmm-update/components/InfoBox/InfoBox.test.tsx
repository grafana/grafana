import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { InfoBox } from './InfoBox';
import { Messages } from './InfoBox.messages';

describe('InfoBox::', () => {
  it('should show that there are no updates by default', () => {
    render(
      <MemoryRouter>
        <InfoBox />
      </MemoryRouter>
    );

    expect(screen.getByText(Messages.noUpdates)).toBeInTheDocument();
    expect(screen.getByText(Messages.updatesNotice)).toBeInTheDocument();
  });

  it('should show a different message if upToDate is true', () => {
    render(
      <MemoryRouter>
        <InfoBox upToDate />
      </MemoryRouter>
    );

    expect(screen.getByText(Messages.upToDate)).toBeInTheDocument();
  });

  it('should show an insufficient access message', () => {
    render(
      <MemoryRouter>
        <InfoBox hasNoAccess />
      </MemoryRouter>
    );

    expect(screen.getByText(Messages.noAccess)).toBeInTheDocument();
  });

  it('should show updates disabled messages', () => {
    render(
      <MemoryRouter>
        <InfoBox updatesDisabled />
      </MemoryRouter>
    );
    expect(screen.getByTestId('updates-disabled').textContent).toBe(
      `${Messages.updatesDisabled}${Messages.pmmSettings}`
    );
  });

  it('should show not online messages', () => {
    render(
      <MemoryRouter>
        <InfoBox isOnline={false} />
      </MemoryRouter>
    );

    expect(screen.getByText(Messages.notOnline)).toBeInTheDocument();
  });
});
