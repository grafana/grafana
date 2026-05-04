import { fireEvent, render, screen } from '@testing-library/react';
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
const setCorner = jest.fn();

const buildContext = (overrides: Partial<FeatureControlContextType> = {}): FeatureControlContextType => ({
  isAccessible: true,
  setIsAccessible,
  isOpen: false,
  setIsOpen,
  corner: 'bottom-right',
  setCorner,
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

    expect(screen.getByRole('button', { name: 'Feature control' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Feature control' })).toHaveAttribute(
      'data-tooltip',
      'Open feature control'
    );
    expect(screen.getByRole('button', { name: 'Feature control' })).toHaveAttribute('data-variant', 'default');
  });

  it('renders an expanded button when feature control is open', () => {
    useFeatureControlContextMock.mockReturnValue(buildContext({ isOpen: true }));

    render(<FeatureControlButton />);

    expect(screen.getByRole('button', { name: 'Feature control' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Feature control' })).toHaveAttribute(
      'data-tooltip',
      'Close feature control'
    );
    expect(screen.getByRole('button', { name: 'Feature control' })).toHaveAttribute('data-variant', 'active');
  });

  it('toggles the open state when clicked', () => {
    render(<FeatureControlButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Feature control' }));

    expect(setIsOpen).toHaveBeenCalledWith(true);
  });
});
