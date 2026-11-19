import { render, screen } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';

import { SectionNav } from './SectionNav';

// Links an app injects into a group can arrive without an id of their own
const groups: NavModelItem[] = [
  {
    id: 'cfg/general',
    text: 'General',
    children: [
      { id: 'org-settings', text: 'Default preferences', url: '/org' },
      { text: 'Logs', url: '/a/dbconfig/logs' },
      { text: 'Traces', url: '/a/dbconfig/traces' },
    ],
  },
];

describe('SectionNav', () => {
  it('marks no link current when none is active, including links without an id', () => {
    render(<SectionNav label="Administration" groups={groups} />);

    expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });

  it('marks only the active link current', () => {
    render(<SectionNav label="Administration" groups={groups} activeId="org-settings" />);

    expect(screen.getByRole('link', { name: 'Default preferences', current: 'page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Logs' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Traces' })).not.toHaveAttribute('aria-current');
  });
});
