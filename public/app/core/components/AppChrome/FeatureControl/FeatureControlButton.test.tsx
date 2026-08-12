import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentPropsWithoutRef } from 'react';

import { FeatureControlButton } from './FeatureControlButton';
import { type FeatureControlContextType, useFeatureControlContext } from './FeatureControlProvider';

type MockToolbarButtonProps = ComponentPropsWithoutRef<'button'> & {
  icon?: string;
  iconOnly?: boolean;
  tooltip?: string;
  variant?: string;
};

const setIsAccessible = jest.fn();
const setIsOpen = jest.fn();

const buildContext = (overrides: Partial<FeatureControlContextType> = {}): FeatureControlContextType => ({
  isAccessible: true,
  setIsAccessible,
  isOpen: false,
  setIsOpen,
  ...overrides,
});

jest.mock('@grafana/ui', () => ({
  ToolbarButton: ({
    icon: _icon,
    iconOnly: _iconOnly,
    onClick,
    tooltip,
    variant,
    ...props
  }: MockToolbarButtonProps) => (
    <button {...props} data-tooltip={tooltip} data-variant={variant} onClick={onClick}>
      {props['aria-label']}
    </button>
  ),
}));

jest.mock('./FeatureControlProvider', () => ({
  useFeatureControlContext: jest.fn(),
}));

describe('FeatureControlButton', () => {
  const useFeatureControlContextMock = jest.mocked(useFeatureControlContext);
  const getButton = () => screen.getByRole('button', { name: 'Feature control' });

  const expectButton = ({ expanded, tooltip, variant }: { expanded: string; tooltip: string; variant: string }) => {
    const button = getButton();
    expect(button).toHaveAttribute('aria-expanded', expanded);
    expect(button).toHaveAttribute('data-tooltip', tooltip);
    expect(button).toHaveAttribute('data-variant', variant);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    useFeatureControlContextMock.mockReturnValue(buildContext());
  });

  it('does not render when feature control is not accessible', () => {
    useFeatureControlContextMock.mockReturnValue(buildContext({ isAccessible: false }));

    render(<FeatureControlButton />);

    expect(screen.queryByRole('button', { name: 'Feature control' })).not.toBeInTheDocument();
  });

  it('renders a collapsed button when feature control is closed', () => {
    render(<FeatureControlButton />);

    expectButton({ expanded: 'false', tooltip: 'Open feature control', variant: 'default' });
  });

  it('renders an expanded button when feature control is open', () => {
    useFeatureControlContextMock.mockReturnValue(buildContext({ isOpen: true }));

    render(<FeatureControlButton />);

    expectButton({ expanded: 'true', tooltip: 'Close feature control', variant: 'active' });
  });

  it('toggles the open state when clicked', async () => {
    render(<FeatureControlButton />);

    await userEvent.click(getButton());

    expect(setIsOpen).toHaveBeenCalledWith(true);
  });
});
