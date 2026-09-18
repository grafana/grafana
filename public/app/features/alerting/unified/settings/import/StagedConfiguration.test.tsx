import { within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { base64UrlEncode } from '@grafana/alerting';

import { setupMswServer } from '../../mockApi';

import { StagedConfiguration } from './StagedConfiguration';

const alertmanagerConfig = `
route:
  receiver: default
  routes:
    - receiver: slack-platform
      object_matchers:
        - [team, "=", platform]
receivers:
  - name: default
  - name: slack-platform
templates:
  - my-template.tmpl
time_intervals:
  - name: weekends
inhibit_rules:
  - equal: [alertname]
`;

const stagedConfig = {
  identifier: 'prometheus-prod',
  alertmanager_config: alertmanagerConfig,
  template_files: {},
};

// A routing tree with two direct children, one of which has two nested routes of its own. The import is one
// tree, so the section count is 1 and the tree's own route count is its two direct children — the same number
// the notification policies page shows for it, not the four descendants.
const nestedPoliciesConfig = {
  identifier: 'nested',
  alertmanager_config: `
route:
  receiver: root
  routes:
    - receiver: a
      routes:
        - receiver: a1
        - receiver: a2
    - receiver: b
receivers:
  - name: root
  - name: a
  - name: a1
  - name: a2
  - name: b
`,
};

const server = setupMswServer();

const ui = {
  heading: byRole('heading', { name: 'prometheus-prod' }),
  badge: byText(/staged · read-only/i),
  contactPointsSection: byRole('button', { name: /contact points/i }),
  notificationPoliciesSection: byRole('button', { name: /notification polic/i }),
  notificationPoliciesContent: byRole('region', { name: /notification polic/i }),
  expandAll: byRole('button', { name: /expand all/i }),
  syncedBadge: byText(/synced · read-only/i),
  syncManagedNote: byText(/kept up to date by auto-sync/i),
  parseError: byText(/couldn't read the staged configuration/i),
  revertButton: byRole('button', { name: /^revert$/i }),
  promoteButton: byRole('button', { name: /promote to live config/i }),
  promoteModalTitle: byRole('heading', { name: /promote this configuration/i }),
  revertModalTitle: byRole('heading', { name: /revert this staged configuration/i }),
  noPermissionTooltip: byText(/don't have permission to modify/i),
};

describe('StagedConfiguration', () => {
  it('renders the identifier, staged badge and resource sections', () => {
    render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

    expect(ui.heading.get()).toBeInTheDocument();
    expect(ui.badge.get()).toBeInTheDocument();
    expect(ui.contactPointsSection.get()).toBeInTheDocument();
  });

  it('expands a section to reveal resource names', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

    await user.click(ui.contactPointsSection.get());

    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('slack-platform')).toBeInTheDocument();
  });

  it('reveals every section when Expand all is clicked', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

    await user.click(ui.expandAll.get());

    expect(screen.getByText('my-template.tmpl')).toBeInTheDocument();
    expect(screen.getByText('weekends')).toBeInTheDocument();
  });

  it('links each resource to its detail/list page', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

    await user.click(ui.expandAll.get());

    const hrefs = screen.getAllByRole('link', { name: /view/i }).map((link) => link.getAttribute('href'));

    // Contact points are addressed by base64url(name).
    expect(hrefs.some((href) => href?.includes(`/receivers/${base64UrlEncode('default')}/edit`))).toBe(true);
    // Time intervals use the raw name.
    expect(hrefs.some((href) => href?.includes('/mute-timing/edit') && href?.includes('muteName=weekends'))).toBe(true);
    // Templates have no per-item detail page, so they link to the templates list.
    expect(hrefs.some((href) => href?.includes('/alerting/notifications/templates') && !href.includes('/edit'))).toBe(
      true
    );
    // Notification policies filter the routes tree by matcher query string, pinned to the Grafana
    // Alertmanager so the link always opens the staged config (not whichever AM is in localStorage),
    // and to the staged config's own routing tree so live trees are not listed alongside it.
    // Matched on the trailing "?" so the /alerting/routes/mute-timing/edit link is not picked up here.
    const routeHrefs = hrefs.filter((href) => href?.includes('/alerting/routes?'));
    expect(routeHrefs.length).toBeGreaterThan(0);
    routeHrefs.forEach((href) => {
      expect(href).toContain('alertmanager=grafana');
      expect(href).toContain('includeTree=prometheus-prod');
    });
    // The child route's matcher value is quoted so the routes filter parses it back intact.
    const childPolicyHref = routeHrefs.find((href) => href?.includes('queryString'));
    const policyParams = new URLSearchParams(childPolicyHref?.split('?')[1]);
    expect(policyParams.get('queryString')).toBe('team="platform"');
  });

  it('links resources renamed by the merge under their post-merge name', async () => {
    // "default" and "weekends" are already taken in the live config, so the backend addresses the staged
    // copies as "<name>_<identifier>". "slack-platform" is free and keeps its name.
    const { user } = render(
      <StagedConfiguration
        stagedConfig={stagedConfig}
        canPromote
        canRevert
        liveConfig={{ receivers: [{ name: 'default' }], time_intervals: [{ name: 'weekends', time_intervals: [] }] }}
      />
    );

    await user.click(ui.expandAll.get());

    const hrefs = screen.getAllByRole('link', { name: /view/i }).map((link) => link.getAttribute('href'));

    expect(hrefs).toContainEqual(
      expect.stringContaining(`/receivers/${base64UrlEncode('default_prometheus-prod')}/edit`)
    );
    expect(hrefs).not.toContainEqual(expect.stringContaining(`/receivers/${base64UrlEncode('default')}/edit`));
    expect(hrefs).toContainEqual(expect.stringContaining('muteName=weekends_prometheus-prod'));
    // Unaffected resources keep their original name.
    expect(hrefs).toContainEqual(expect.stringContaining(`/receivers/${base64UrlEncode('slack-platform')}/edit`));
    // The labels still show the staged config's own names — only the link targets are the merged ones.
    expect(screen.queryByText('default_prometheus-prod')).not.toBeInTheDocument();
    expect(screen.queryByText('weekends_prometheus-prod')).not.toBeInTheDocument();
  });

  it('shows inhibition rule details inline (no link)', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

    await user.click(ui.expandAll.get());

    expect(screen.getByText(/equal:\s*alertname/i)).toBeInTheDocument();
  });

  it('presents the import as a single routing tree named after the identifier', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={nestedPoliciesConfig} canPromote canRevert />);

    // One import contributes one routing tree, so the section count is 1 regardless of the tree's size.
    expect(within(ui.notificationPoliciesSection.get()).getByText('1')).toBeInTheDocument();

    await user.click(ui.notificationPoliciesSection.get());
    const section = ui.notificationPoliciesContent.get();

    // The tree row is named after the identifier and reports its two direct children — the routes nested
    // under "a" are not counted, matching the notification policies page.
    expect(within(section).getByText('nested')).toBeInTheDocument();
    expect(within(section).getByText(/→ root · 2 routes/)).toBeInTheDocument();
  });

  it('does not label the imported root as the default policy', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

    await user.click(ui.notificationPoliciesSection.get());

    // The imported root is the root of managed route "prometheus-prod", not the Grafana default policy.
    expect(screen.queryByText(/default policy/i)).not.toBeInTheDocument();
  });

  it('shows an error when the configuration cannot be parsed', () => {
    render(
      <StagedConfiguration
        stagedConfig={{ identifier: 'broken', alertmanager_config: 'foo: [bar' }}
        canPromote
        canRevert
      />
    );

    expect(ui.parseError.get()).toBeInTheDocument();
  });

  describe('promote/revert actions', () => {
    it('enables the actions when the user can update', () => {
      render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

      expect(ui.revertButton.get()).toBeEnabled();
      expect(ui.promoteButton.get()).toBeEnabled();
    });

    it('disables the actions with an explanatory tooltip when the user cannot update', async () => {
      const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote={false} canRevert={false} />);

      // Buttons with a tooltip render aria-disabled (wrapped so the tooltip still shows on hover)
      // rather than the native disabled attribute.
      expect(ui.revertButton.get()).toHaveAttribute('aria-disabled', 'true');
      expect(ui.promoteButton.get()).toHaveAttribute('aria-disabled', 'true');

      await user.hover(ui.promoteButton.get());
      expect(await ui.noPermissionTooltip.find()).toBeInTheDocument();
    });

    // Promote and revert are authorized independently by the backend, so a user holding only the scoped
    // delete permission must still be able to revert.
    it('gates promote and revert independently', () => {
      render(<StagedConfiguration stagedConfig={stagedConfig} canPromote={false} canRevert />);

      expect(ui.revertButton.get()).toBeEnabled();
      expect(ui.promoteButton.get()).toHaveAttribute('aria-disabled', 'true');
    });

    it('opens the promote modal from the header action', async () => {
      server.use(http.post('/api/convert/api/v1/alerts', () => HttpResponse.json({ status: 'success' })));
      const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

      await user.click(ui.promoteButton.get());

      expect(await ui.promoteModalTitle.find()).toBeInTheDocument();
    });

    it('opens the revert modal from the header action', async () => {
      const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert />);

      await user.click(ui.revertButton.get());

      expect(await ui.revertModalTitle.find()).toBeInTheDocument();
    });
  });

  describe('when the staged config belongs to auto-sync', () => {
    it('hides revert and explains why', () => {
      render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert isSyncManaged />);

      expect(ui.revertButton.query()).not.toBeInTheDocument();
      expect(ui.syncManagedNote.get()).toBeInTheDocument();
      expect(ui.promoteButton.get()).toBeEnabled();
    });

    it('marks the card as synced rather than staged', () => {
      render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert isSyncManaged />);

      expect(ui.syncedBadge.get()).toBeInTheDocument();
      expect(ui.badge.query()).not.toBeInTheDocument();
    });

    it('warns in the promote modal that the sync stops', async () => {
      server.use(http.post('/api/convert/api/v1/alerts', () => HttpResponse.json({ status: 'success' })));
      const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} canPromote canRevert isSyncManaged />);

      await user.click(ui.promoteButton.get());

      expect(await screen.findByText(/this will stop auto-sync/i)).toBeInTheDocument();
    });
  });
});
