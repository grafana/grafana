import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Tab } from './Tab';
import { TabsBar } from './TabsBar';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

const onChangeTab = jest.fn();

describe('Tabs', () => {
  beforeEach(() => {
    onChangeTab.mockClear();
  });
  it('should call onChangeTab when clicking a tab', async () => {
    const { user } = setup(
      <TabsBar>
        <Tab label="Tab 1" active={false} onChangeTab={onChangeTab} />
      </TabsBar>
    );

    const tab = screen.getByRole('tab');
    await user.click(tab);

    expect(onChangeTab).toHaveBeenCalledTimes(1);
  });

  it('should render active tab correctly', () => {
    render(
      <TabsBar>
        <Tab label="Active Tab" active={true} onChangeTab={onChangeTab} />
        <Tab label="Inactive Tab" active={false} onChangeTab={onChangeTab} />
      </TabsBar>
    );

    const activeTab = screen.getByRole('tab', { name: 'Active Tab' });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should render tabs with icons', () => {
    render(
      <TabsBar>
        <Tab label="Tab with Icon" active={true} onChangeTab={onChangeTab} icon="star" />
      </TabsBar>
    );

    const icon = screen.getByTestId('tab-icon-star');
    expect(icon).toBeInTheDocument();
  });

  it('should render tabs with counters', () => {
    render(
      <TabsBar>
        <Tab label="Tab with Counter" active={true} onChangeTab={onChangeTab} counter={5} />
      </TabsBar>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render tabs with tooltips', async () => {
    const { user } = setup(
      <TabsBar>
        <Tab label="Tab with Tooltip" active={true} onChangeTab={onChangeTab} tooltip="Tooltip content" />
      </TabsBar>
    );

    const tab = screen.getByRole('tab');
    await user.hover(tab);

    expect(await screen.findByText('Tooltip content')).toBeInTheDocument();
  });

  it('should render tabs as links when href is provided', () => {
    render(
      <TabsBar>
        <Tab label="Link Tab" active={true} onChangeTab={onChangeTab} href="/some-path" />
      </TabsBar>
    );

    const link = screen.getByRole('tab');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/some-path');
  });

  it('should render tabs with suffix content', () => {
    const Suffix = () => <span data-testid="tab-suffix">Suffix</span>;

    render(
      <TabsBar>
        <Tab label="Tab with Suffix" active={true} onChangeTab={onChangeTab} suffix={Suffix} />
      </TabsBar>
    );

    expect(screen.getByTestId('tab-suffix')).toBeInTheDocument();
  });

  it('should render disabled tab correctly', () => {
    render(
      <TabsBar>
        <Tab label="Disabled Tab" active={false} onChangeTab={onChangeTab} disabled={true} />
      </TabsBar>
    );

    const disabledTab = screen.getByRole('tab', { name: 'Disabled Tab' });
    expect(disabledTab).toHaveAttribute('aria-disabled', 'true');
  });

  it('should not call onChangeTab when disabled tab is clicked', async () => {
    const { user } = setup(
      <TabsBar>
        <Tab label="Disabled Tab" active={false} onChangeTab={onChangeTab} disabled={true} />
      </TabsBar>
    );

    const disabledTab = screen.getByRole('tab', { name: 'Disabled Tab' });
    await user.click(disabledTab);

    expect(onChangeTab).not.toHaveBeenCalled();
  });
});
