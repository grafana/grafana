import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { reportInteraction } from '@grafana/runtime';

import { AngularDeprecationNotice } from './AngularDeprecationNotice';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

function localStorageKey(dsUid: string) {
  return `grafana.angularDeprecation.dashboardNoticeAndMigration.isDismissed.${dsUid}`;
}

describe('AngularDeprecationNotice', () => {
  const noticeText = /This dashboard depends on Angular/i;
  const dsUid = 'abc';

  afterAll(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('should render', () => {
    render(<AngularDeprecationNotice dashboardUid={dsUid} />);
    expect(screen.getByText(noticeText)).toBeInTheDocument();
  });

  it('should be dismissable', async () => {
    render(<AngularDeprecationNotice dashboardUid={dsUid} />);
    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();
    await userEvent.click(closeButton);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });

  it('should persist dismission status in localstorage', async () => {
    render(<AngularDeprecationNotice dashboardUid={dsUid} />);
    expect(window.localStorage.getItem(localStorageKey(dsUid))).toBeNull();
    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();
    await userEvent.click(closeButton);
    expect(window.localStorage.getItem(localStorageKey(dsUid))).toBe('true');
  });

  it('should not re-render alert if already dismissed', () => {
    window.localStorage.setItem(localStorageKey(dsUid), 'true');
    render(<AngularDeprecationNotice dashboardUid={dsUid} />);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });

  it('should call reportInteraction when dismissing', async () => {
    render(<AngularDeprecationNotice dashboardUid={dsUid} />);
    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();
    await userEvent.click(closeButton);
    expect(reportInteraction).toHaveBeenCalledWith('angular_deprecation_notice_dismissed');
  });

  describe('auto migrate button', () => {
    const autoMigrateText = 'Try migration';

    it('should display auto migrate button if showAutoMigrateLink is true', () => {
      render(<AngularDeprecationNotice dashboardUid={dsUid} showAutoMigrateLink={true} />);
      const autoMigrateButton = screen.getByRole('button', { name: /Try migration/i });
      expect(autoMigrateButton).toBeInTheDocument();
    });

    it('should not display auto migrate button if showAutoMigrateLink is false', () => {
      render(<AngularDeprecationNotice dashboardUid={dsUid} showAutoMigrateLink={false} />);
      expect(screen.queryByText(autoMigrateText)).not.toBeInTheDocument();
    });

    it('should not display auto migrate link if showAutoMigrateLink is not provided', () => {
      render(<AngularDeprecationNotice dashboardUid={dsUid} />);
      expect(screen.queryByText(autoMigrateText)).not.toBeInTheDocument();
    });
  });
});
