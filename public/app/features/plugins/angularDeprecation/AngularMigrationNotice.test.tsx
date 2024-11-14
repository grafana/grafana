import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AngularMigrationNotice } from './AngularMigrationNotice';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('AngularMigrationNotice', () => {
  const noticeText =
    /This dashboard was migrated from Angular. Please make sure everything is behaving as expected and save and refresh this dashboard to persist the migration./i;
  const dsUid = 'abc';

  afterAll(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('Migration alert buttons', () => {
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
  });
});
