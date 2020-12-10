import React, { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnconnectedReturnToDashboardButton as ReturnToDashboardButton } from './ReturnToDashboardButton';
import { ExploreId } from 'app/types/explore';

const createProps = (propsOverride?: Partial<ComponentProps<typeof ReturnToDashboardButton>>) => {
  const defaultProps = {
    originPanelId: 1,
    exploreId: ExploreId.left,
    queries: [],
    updateLocation: jest.fn(),
    setDashboardQueriesToUpdateOnLoad: jest.fn(),
  };

  return Object.assign(defaultProps, propsOverride) as ComponentProps<typeof ReturnToDashboardButton>;
};

describe('ReturnToDashboardButton', () => {
  it('should render 2 buttons if dashboard is editable', () => {
    render(<ReturnToDashboardButton {...createProps()} />);
    expect(screen.getAllByTestId(/returnButton/i)).toHaveLength(2);
  });
  it('should render 1 button if dashboard is not editable', () => {
    render(<ReturnToDashboardButton {...createProps({ originPanelId: undefined })} />);
    expect(screen.getAllByTestId(/returnButton/i)).toHaveLength(1);
  });
  it('should show option to return to dashboard with changes', () => {
    render(<ReturnToDashboardButton {...createProps()} />);
    const returnWithChangesButton = screen.getByTestId('returnButtonWithChanges');
    const selectButton = returnWithChangesButton.querySelector('.select-button');
    if (selectButton) {
      fireEvent.click(selectButton);
    }
    expect(screen.getAllByText('Return to panel with changes')).toHaveLength(1);
  });
});
