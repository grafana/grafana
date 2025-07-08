import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { IconName } from '@grafana/data';

import { TabbedContainer } from './TabbedContainer';

const icon: IconName = 'info-circle';
const icon2: IconName = 'user';
const icon3: IconName = 'cog';

const mockTabs = [
  {
    label: 'Tab 1',
    value: 'tab1',
    content: <div data-testid="tab1-content">Tab 1 Content</div>,
    icon: icon,
  },
  {
    label: 'Tab 2',
    value: 'tab2',
    content: <div data-testid="tab2-content">Tab 2 Content</div>,
    icon: icon2,
  },
  {
    label: 'Tab 3',
    value: 'tab3',
    content: <div data-testid="tab3-content">Tab 3 Content</div>,
    icon: icon3,
  },
];

const mockOnClose = jest.fn();
const defaultProps = {
  tabs: mockTabs,
  onClose: mockOnClose,
};

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

describe('TabbedContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all tabs with their labels and icons', () => {
    render(<TabbedContainer {...defaultProps} />);

    mockTabs.forEach((tab) => {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
      expect(screen.getByText(tab.label).closest('button')?.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('should render the first tab content by default', () => {
    render(<TabbedContainer {...defaultProps} />);

    expect(screen.getByTestId('tab1-content')).toBeInTheDocument();
    expect(screen.queryByTestId('tab2-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab3-content')).not.toBeInTheDocument();
  });

  it('should render the default tab content when specified', () => {
    render(<TabbedContainer {...defaultProps} defaultTab="tab2" />);

    expect(screen.queryByTestId('tab1-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('tab2-content')).toBeInTheDocument();
    expect(screen.queryByTestId('tab3-content')).not.toBeInTheDocument();
  });

  it('should switch content when clicking on different tabs', async () => {
    const { user } = setup(<TabbedContainer {...defaultProps} />);

    expect(screen.getByTestId('tab1-content')).toBeInTheDocument();

    await user.click(screen.getByText('Tab 2'));

    expect(screen.queryByTestId('tab1-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('tab2-content')).toBeInTheDocument();

    await user.click(screen.getByText('Tab 3'));

    expect(screen.queryByTestId('tab1-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab2-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('tab3-content')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const { user } = setup(<TabbedContainer {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
