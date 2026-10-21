import { render, screen } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { RulesPageShell } from './RulesPageShell';

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

  it('shows the page body and the Recently deleted tab to an organization Admin', () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    renderShell('active');

    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recently deleted' })).toBeInTheDocument();
  });

  it('hides the Recently deleted tab from a non-Admin', () => {
    contextSrv.user.orgRole = OrgRole.Editor;

    renderShell('active');

    expect(screen.getByRole('tab', { name: 'Alert rules' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Recently deleted' })).not.toBeInTheDocument();
  });

  it.each([
    { activeTab: 'active', selected: 'Alert rules', other: 'Recently deleted' },
    { activeTab: 'deleted', selected: 'Recently deleted', other: 'Alert rules' },
  ] as const)('marks only the $selected tab as selected on the $activeTab page', ({ activeTab, selected, other }) => {
    contextSrv.user.orgRole = OrgRole.Admin;

    renderShell(activeTab);

    expect(screen.getByRole('tab', { name: selected })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: other })).toHaveAttribute('aria-selected', 'false');
  });
});
