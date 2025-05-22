import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LinkModel, ActionModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { DataLinksActionsTooltip } from './DataLinksActionsTooltip';

describe('DataLinksActionsTooltip', () => {
  const mockCoords = { clientX: 100, clientY: 100 };
  const mockLink: LinkModel = {
    href: 'http://link1.com',
    title: 'Data Link1',
    target: '_blank',
    onClick: jest.fn(),
    origin: { ref: { uid: 'test' } },
  };

  const mockAction: ActionModel = {
    title: 'Action1',
    onClick: jest.fn(),
    confirmation: jest.fn(),
    style: { backgroundColor: '#ff0000' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when there is only one link', () => {
    const { container } = render(<DataLinksActionsTooltip links={[mockLink]} actions={[]} coords={mockCoords} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render tooltip with multiple links', async () => {
    const multipleLinks = [mockLink, { ...mockLink, title: 'Data Link2', href: 'http://link2.com' }];
    render(<DataLinksActionsTooltip links={multipleLinks} coords={mockCoords} />);

    expect(screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper)).toBeInTheDocument();
    expect(await screen.findByText('Data Link1')).toBeInTheDocument();

    const link = screen.getByText('Data Link1');
    await userEvent.click(link);
    expect(mockLink.onClick).toHaveBeenCalledTimes(1);
  });

  it('should handle links click events', async () => {
    const mockLinks = [mockLink, { ...mockLink, title: 'Data Link2', href: 'http://link2.com' }];

    render(<DataLinksActionsTooltip links={mockLinks} coords={mockCoords} />);

    const link = screen.getByText('Data Link1');
    await userEvent.click(link);
    expect(mockLink.onClick).toHaveBeenCalledTimes(1);
  });

  it('should render when there is only one action', () => {
    const { container } = render(<DataLinksActionsTooltip links={[]} actions={[mockAction]} coords={mockCoords} />);
    expect(container).toBeInTheDocument();
  });

  it('should render tooltip with actions', () => {
    const mockActions = [mockAction, { ...mockAction, title: 'Action2' }];

    render(<DataLinksActionsTooltip links={[]} actions={mockActions} coords={mockCoords} />);

    expect(screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper)).toBeInTheDocument();

    // Action button should be rendered
    const actionButton = screen.getByText('Action1');
    expect(actionButton).toBeInTheDocument();
  });

  it('should call onTooltipClose when tooltip is dismissed', async () => {
    const onTooltipClose = jest.fn();
    render(
      <DataLinksActionsTooltip
        links={[mockLink, { ...mockLink, title: 'Data Link2', href: 'http://link2.com' }]}
        coords={mockCoords}
        onTooltipClose={onTooltipClose}
      />
    );

    // click outside the tooltip
    await userEvent.click(document.body);

    expect(onTooltipClose).toHaveBeenCalledTimes(1);
  });

  it('should render custom value', () => {
    const customValue = <div data-testid="custom-value">Custom Value</div>;
    render(<DataLinksActionsTooltip links={[mockLink]} coords={mockCoords} value={customValue} />);

    expect(screen.getByTestId('custom-value')).toBeInTheDocument();
  });
});
