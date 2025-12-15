import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DashboardLink } from '@grafana/schema';

import { DashboardLinkForm } from './DashboardLinkForm';
import { NEW_LINK } from './utils';

describe('DashboardLinkForm', () => {
  const defaultLink: DashboardLink = {
    title: 'Test Link',
    type: 'link',
    url: 'https://example.com',
    icon: 'external link',
    tags: [],
    asDropdown: false,
    targetBlank: false,
    includeVars: false,
    keepTime: false,
    tooltip: '',
  };

  it('should render the "Show in controls menu" checkbox', () => {
    const onUpdate = jest.fn();
    const onGoBack = jest.fn();

    render(<DashboardLinkForm link={defaultLink} onUpdate={onUpdate} onGoBack={onGoBack} />);

    expect(screen.getByText('Show in controls menu')).toBeInTheDocument();
  });

  it('should call onUpdate with placement="inControlsMenu" when checkbox is checked', async () => {
    const onUpdate = jest.fn();
    const onGoBack = jest.fn();
    const user = userEvent.setup();

    render(<DashboardLinkForm link={defaultLink} onUpdate={onUpdate} onGoBack={onGoBack} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Show in controls menu' });
    await user.click(checkbox);

    expect(onUpdate).toHaveBeenCalledWith({
      ...defaultLink,
      placement: 'inControlsMenu',
    });
  });

  it('should call onUpdate with placement=undefined when checkbox is unchecked', async () => {
    const onUpdate = jest.fn();
    const onGoBack = jest.fn();
    const user = userEvent.setup();

    const linkWithPlacement: DashboardLink = {
      ...defaultLink,
      placement: 'inControlsMenu',
    };

    render(<DashboardLinkForm link={linkWithPlacement} onUpdate={onUpdate} onGoBack={onGoBack} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Show in controls menu' });
    await user.click(checkbox);

    expect(onUpdate).toHaveBeenCalledWith({
      ...linkWithPlacement,
      placement: undefined,
    });
  });

  it('should have checkbox checked when placement is "inControlsMenu"', () => {
    const onUpdate = jest.fn();
    const onGoBack = jest.fn();

    const linkWithPlacement: DashboardLink = {
      ...defaultLink,
      placement: 'inControlsMenu',
    };

    render(<DashboardLinkForm link={linkWithPlacement} onUpdate={onUpdate} onGoBack={onGoBack} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Show in controls menu' });
    expect(checkbox).toBeChecked();
  });

  it('should have checkbox unchecked when placement is undefined', () => {
    const onUpdate = jest.fn();
    const onGoBack = jest.fn();

    render(<DashboardLinkForm link={defaultLink} onUpdate={onUpdate} onGoBack={onGoBack} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Show in controls menu' });
    expect(checkbox).not.toBeChecked();
  });

  it('should render checkbox for dashboards type links', () => {
    const onUpdate = jest.fn();
    const onGoBack = jest.fn();

    const dashboardsLink: DashboardLink = {
      ...defaultLink,
      type: 'dashboards',
      url: '',
    };

    render(<DashboardLinkForm link={dashboardsLink} onUpdate={onUpdate} onGoBack={onGoBack} />);

    expect(screen.getByText('Show in controls menu')).toBeInTheDocument();
  });

  it('should autofocus title input for new links', () => {
    const onUpdate = jest.fn();
    const onGoBack = jest.fn();

    render(<DashboardLinkForm link={NEW_LINK} onUpdate={onUpdate} onGoBack={onGoBack} />);

    const titleInput = screen.getByRole('textbox', { name: 'Title' });
    expect(titleInput).toHaveFocus();
  });
});
