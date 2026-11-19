import { render, screen } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';

import { SectionNav } from './SectionNav';

const groups: NavModelItem[] = [
  {
    id: 'cfg/general',
    text: 'General',
    children: [
      { id: 'org-settings', text: 'Default preferences', url: '/org', icon: 'sliders-v-alt' },
      { id: 'no-icon', text: 'No icon', url: '/no-icon' },
    ],
  },
];

describe('SectionNav icons', () => {
  it('holds the place of a missing icon with an empty, hidden space the width of one', () => {
    render(<SectionNav label="Administration" groups={groups} />);

    const withIcon = screen.getByRole('link', { name: 'Default preferences' });
    const withoutIcon = screen.getByRole('link', { name: 'No icon' });

    expect(withIcon.querySelector('svg')).toBeInTheDocument();
    expect(withoutIcon.querySelector('svg')).not.toBeInTheDocument();

    const space = withoutIcon.firstElementChild;
    expect(space?.tagName).toBe('SPAN');
    expect(space).toHaveAttribute('aria-hidden', 'true');
    expect(space).toBeEmptyDOMElement();
    expect(space).toHaveStyle({ width: '16px' });
  });
});
