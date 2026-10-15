import { render, screen } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { RulesPageShell } from './RulesPageShell';

// NAV-2
describe('RulesPageShell', () => {
  const previousRole = contextSrv.user.orgRole;

  afterEach(() => {
    contextSrv.user.orgRole = previousRole;
  });

  function renderShell(activeTab: 'active' | 'deleted') {
    return render(
      <RulesPageShell
        navId="alert-rules"
        pageLabel="Alert rules"
        activeTab={activeTab}
        activeHref="/alerting/rules/alert"
        deletedHref="/alerting/rules/alert/deleted"
      >
        <div>page body</div>
      </RulesPageShell>
    );
  }

  it('shows the Recently deleted tab for an organization Admin', () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    renderShell('active');

    expect(screen.getByRole('tab', { name: 'Recently deleted' })).toBeInTheDocument();
  });

  it('hides the Recently deleted tab for a non-Admin', () => {
    contextSrv.user.orgRole = OrgRole.Editor;

    renderShell('active');

    expect(screen.queryByRole('tab', { name: 'Recently deleted' })).not.toBeInTheDocument();
  });

  it('marks the first (page-name) tab as selected on the active page', () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    renderShell('active');

    expect(screen.getByRole('tab', { name: 'Alert rules' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'false');
  });

  it('marks the Recently deleted tab as selected on the deleted page', () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    renderShell('deleted');

    expect(screen.getByRole('tab', { name: 'Alert rules' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders the page body', () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    renderShell('active');

    expect(screen.getByText('page body')).toBeInTheDocument();
  });
});
