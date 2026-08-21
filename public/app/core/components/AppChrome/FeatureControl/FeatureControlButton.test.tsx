import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { FeatureControlButton } from './FeatureControlButton';
import { type FeatureControlContextType, useFeatureControlContext } from './FeatureControlProvider';
import { useFeatureFlagOverrides } from './useFeatureFlagOverrides';

type MockToolbarButtonProps = ComponentPropsWithoutRef<'button'> & {
  icon?: ReactNode;
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
  ToolbarButton: ({ icon, iconOnly: _iconOnly, onClick, tooltip, variant, ...props }: MockToolbarButtonProps) => (
    <button {...props} data-tooltip={tooltip} data-variant={variant} onClick={onClick}>
      {icon}
      {props['aria-label']}
    </button>
  ),
}));

jest.mock('./FeatureControlProvider', () => ({
  useFeatureControlContext: jest.fn(),
}));

jest.mock('./useFeatureFlagOverrides', () => ({
  useFeatureFlagOverrides: jest.fn(),
}));

// Stubbed so these tests assert what this component is responsible for — whether it asks the
// flask to bubble. BubblingFlask.test.tsx covers the animation itself.
jest.mock('./BubblingFlask', () => ({
  BubblingFlask: ({ bubbling }: { bubbling?: boolean }) => (
    <span data-testid="flask" data-bubbling={String(Boolean(bubbling))} />
  ),
}));

describe('FeatureControlButton', () => {
  const useFeatureControlContextMock = jest.mocked(useFeatureControlContext);
  const useFeatureFlagOverridesMock = jest.mocked(useFeatureFlagOverrides);
  const getButton = () => screen.getByRole('button', { name: 'Feature control' });

  const expectButton = ({ expanded, tooltip, variant }: { expanded: string; tooltip: string; variant: string }) => {
    const button = getButton();
    expect(button).toHaveAttribute('aria-expanded', expanded);
    expect(button).toHaveAttribute('data-tooltip', tooltip);
    expect(button).toHaveAttribute('data-variant', variant);
  };

  const getFlask = () => screen.getByTestId('flask');

  beforeEach(() => {
    jest.clearAllMocks();

    useFeatureControlContextMock.mockReturnValue(buildContext());
    useFeatureFlagOverridesMock.mockReturnValue([]);
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

  it('leaves the flask still when there are no flag overrides', () => {
    render(<FeatureControlButton />);

    expect(getFlask()).toHaveAttribute('data-bubbling', 'false');
  });

  it('bubbles the flask when a flag override is active', () => {
    useFeatureFlagOverridesMock.mockReturnValue([{ key: 'alpha', value: 'true' }]);

    render(<FeatureControlButton />);

    expect(getFlask()).toHaveAttribute('data-bubbling', 'true');
  });

  it('toggles the open state when clicked', async () => {
    render(<FeatureControlButton />);

    await userEvent.click(getButton());

    expect(setIsOpen).toHaveBeenCalledWith(true);
  });
});
