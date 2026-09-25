import { render, screen } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import RecordingRulesDeletedPage from './RecordingRulesDeletedPage';

describe('RecordingRulesDeletedPage', () => {
  const previousRole = contextSrv.user.orgRole;

  afterEach(() => {
    contextSrv.user.orgRole = previousRole;
  });

  it('renders the Recording rules title with the Recently deleted tab selected', () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    render(<RecordingRulesDeletedPage />);

    expect(screen.getByText('Recording rules')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
  });
});
