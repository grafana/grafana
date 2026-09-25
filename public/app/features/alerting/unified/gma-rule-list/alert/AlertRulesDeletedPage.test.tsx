import { render, screen } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import AlertRulesDeletedPage from './AlertRulesDeletedPage';

describe('AlertRulesDeletedPage', () => {
  const previousRole = contextSrv.user.orgRole;

  afterEach(() => {
    contextSrv.user.orgRole = previousRole;
  });

  it('renders the Alert rules title with the Recently deleted tab selected', () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    render(<AlertRulesDeletedPage />);

    expect(screen.getByText('Alert rules')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
  });
});
