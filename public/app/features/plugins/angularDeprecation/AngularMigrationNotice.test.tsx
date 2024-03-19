import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { AngularMigrationNotice } from './AngularMigrationNotice';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

function localStorageKey(dsUid: string) {
  return `grafana.angularDeprecation.dashboardMigrationNotice.isDismissed.${dsUid}`;
}

describe('AngularMigrationNotice', () => {
  const noticeText =
    /This dashboard was migrated from Angular. Please make sure everything is behaving as expected and save and refresh this dashboard to persist the migration./i;
  const dsUid = 'abc';

  afterAll(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('should render', () => {
    render(<AngularMigrationNotice dashboardUid={dsUid} />);
    expect(screen.getByText(noticeText)).toBeInTheDocument();
  });

  it('should be dismissable', async () => {
    render(<AngularMigrationNotice dashboardUid={dsUid} />);
    const closeButton = screen.getByRole('button', { name: /Close alert/i });
    expect(closeButton).toBeInTheDocument();
    await userEvent.click(closeButton);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });

  it('should persist dismissed status in localstorage', async () => {
    render(<AngularMigrationNotice dashboardUid={dsUid} />);
    expect(window.localStorage.getItem(localStorageKey(dsUid))).toBeNull();
    const closeButton = screen.getByRole('button', { name: /Close alert/i });
    expect(closeButton).toBeInTheDocument();
    await userEvent.click(closeButton);
    expect(window.localStorage.getItem(localStorageKey(dsUid))).toBe('true');
  });

  it('should not re-render alert if already dismissed', () => {
    window.localStorage.setItem(localStorageKey(dsUid), 'true');
    render(<AngularMigrationNotice dashboardUid={dsUid} />);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });

  describe('revert migration button', () => {
    it('should display the "Revert migration" button', () => {
      render(<AngularMigrationNotice dashboardUid={dsUid} />);
      const revertMigrationButton = screen.getByRole('button', { name: /Revert migration/i });
      expect(revertMigrationButton).toBeInTheDocument();
    });

    it('should display the "Report issue" button', () => {
      render(<AngularMigrationNotice dashboardUid={dsUid} />);
      const reportIssueButton = screen.getByRole('button', { name: /Report issue/i });
      expect(reportIssueButton).toBeInTheDocument();
    });

    // it('should not display auto migrate button if showAutoMigrateLink is false', () => {
    //   render(<AngularDeprecationNotice dashboardUid={dsUid} showAutoMigrateLink={false} />);
    //   expect(screen.queryByText(autoMigrateText)).not.toBeInTheDocument();
    // });
    //
    // it('should not display auto migrate link if showAutoMigrateLink is not provided', () => {
    //   render(<AngularDeprecationNotice dashboardUid={dsUid} />);
    //   expect(screen.queryByText(autoMigrateText)).not.toBeInTheDocument();
    // });
  });
});
