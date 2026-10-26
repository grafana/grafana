import { render, screen } from 'test/test-utils';

import { TypeTabs } from './TypeTabs';

const DASHBOARDS = 'dashboard.grafana.app/dashboards';
const NOTEBOOKS = 'dashboard.grafana.app/notebooks';

describe('TypeTabs', () => {
  it('keeps a disabled tab for a known kind with no results, with a tooltip saying why', async () => {
    const { user } = render(<TypeTabs types={[{ value: DASHBOARDS, count: 3 }]} total={3} onSelect={jest.fn()} />);

    const folders = screen.getByRole('tab', { name: /Folders/ });
    expect(folders).toHaveAttribute('aria-disabled', 'true');

    await user.hover(folders);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('No Folders to show, so this tab is disabled');
  });

  it('selects a tab with results but ignores clicks on a disabled one', async () => {
    const onSelect = jest.fn();
    const { user } = render(<TypeTabs types={[{ value: DASHBOARDS, count: 3 }]} total={3} onSelect={onSelect} />);

    await user.click(screen.getByRole('tab', { name: /Dashboards/ }));
    await user.click(screen.getByRole('tab', { name: /Folders/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(DASHBOARDS);
  });

  it('keeps the open tab enabled when it has no results', () => {
    render(<TypeTabs types={[{ value: DASHBOARDS, count: 3 }]} total={3} selected={NOTEBOOKS} onSelect={jest.fn()} />);

    const notebooks = screen.getByRole('tab', { name: /Notebooks/ });
    expect(notebooks).toHaveAttribute('aria-selected', 'true');
    expect(notebooks).not.toHaveAttribute('aria-disabled');
  });

  it('lists empty kinds under More as disabled items with the reason', async () => {
    const { user } = render(<TypeTabs types={[{ value: DASHBOARDS, count: 3 }]} total={3} onSelect={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /More/ }));

    const playlists = await screen.findByRole('menuitem', { name: /Playlists \(0\)/ });
    expect(playlists).toBeDisabled();
    expect(playlists).toHaveTextContent('No Playlists to show, so this tab is disabled');
  });
});
