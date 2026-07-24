import { within } from '@testing-library/react';
import { render, screen } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { base64UrlEncode } from '@grafana/alerting';

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

// A routing tree with a direct child ("a") that itself has two nested routes. Only the root and the
// direct child are listed, so the section count must be 2 — not the recursive descendant total.
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
receivers:
  - name: root
  - name: a
  - name: a1
  - name: a2
`,
};

const ui = {
  heading: byRole('heading', { name: 'prometheus-prod' }),
  badge: byText(/staged · read-only/i),
  contactPointsSection: byRole('button', { name: /contact points/i }),
  notificationPoliciesSection: byRole('button', { name: /notification policies/i }),
  expandAll: byRole('button', { name: /expand all/i }),
  parseError: byText(/couldn't read the staged configuration/i),
};

describe('StagedConfiguration', () => {
  it('renders the identifier, staged badge and resource sections', () => {
    render(<StagedConfiguration stagedConfig={stagedConfig} />);

    expect(ui.heading.get()).toBeInTheDocument();
    expect(ui.badge.get()).toBeInTheDocument();
    expect(ui.contactPointsSection.get()).toBeInTheDocument();
  });

  it('expands a section to reveal resource names', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} />);

    await user.click(ui.contactPointsSection.get());

    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('slack-platform')).toBeInTheDocument();
  });

  it('reveals every section when Expand all is clicked', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} />);

    await user.click(ui.expandAll.get());

    expect(screen.getByText('my-template.tmpl')).toBeInTheDocument();
    expect(screen.getByText('weekends')).toBeInTheDocument();
  });

  it('links each resource to its detail/list page', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} />);

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
    // Notification policies filter the routes tree by matcher query string.
    expect(hrefs.some((href) => href?.includes('/alerting/routes') && href?.includes('team'))).toBe(true);
  });

  it('shows inhibition rule details inline (no link)', async () => {
    const { user } = render(<StagedConfiguration stagedConfig={stagedConfig} />);

    await user.click(ui.expandAll.get());

    expect(screen.getByText(/equal:\s*alertname/i)).toBeInTheDocument();
  });

  it('counts the notification policies section by root and direct children only, not nested routes', () => {
    render(<StagedConfiguration stagedConfig={nestedPoliciesConfig} />);

    // "Default policy" + one direct child ("a") = 2; the two routes nested under "a" are not counted.
    expect(within(ui.notificationPoliciesSection.get()).getByText('2')).toBeInTheDocument();
  });

  it('shows an error when the configuration cannot be parsed', () => {
    render(<StagedConfiguration stagedConfig={{ identifier: 'broken', alertmanager_config: 'foo: [bar' }} />);

    expect(ui.parseError.get()).toBeInTheDocument();
  });
});
