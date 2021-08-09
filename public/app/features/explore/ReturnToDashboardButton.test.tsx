import React, { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { UnconnectedReturnToDashboardButton as ReturnToDashboardButton } from './ReturnToDashboardButton';
import { ExploreId } from 'app/types/explore';

const createProps = (propsOverride?: Partial<ComponentProps<typeof ReturnToDashboardButton>>) => {
  const defaultProps = {
    originPanelId: 1,
    splitted: false,
    canEdit: true,
    exploreId: ExploreId.left,
    queries: [],
    setDashboardQueriesToUpdateOnLoad: jest.fn(),
  };

  return Object.assign(defaultProps, propsOverride) as ComponentProps<typeof ReturnToDashboardButton>;
};

describe('ReturnToDashboardButton', () => {
  it('should render 2 buttons if originPanelId is provided', () => {
    render(<ReturnToDashboardButton {...createProps()} />);
    expect(screen.getAllByTestId(/returnButton/i)).toHaveLength(2);
  });

  it('should not render any button if originPanelId is not provided', () => {
    render(<ReturnToDashboardButton {...createProps({ originPanelId: undefined })} />);
    expect(screen.queryByTestId(/returnButton/i)).toBeNull();
  });

  it('should not render any button if split view', () => {
    render(<ReturnToDashboardButton {...createProps({ splitted: true })} />);
    expect(screen.queryByTestId(/returnButton/i)).toBeNull();
  });

  it('should not render return to panel with changes button if user cannot edit panel', () => {
    render(<ReturnToDashboardButton {...createProps({ canEdit: false })} />);
    expect(screen.getAllByTestId(/returnButton/i)).toHaveLength(1);
  });

  it('should show option to return to dashboard with changes', () => {
    render(<ReturnToDashboardButton {...createProps()} />);
    const returnWithChangesButton = screen.getByTestId('returnButtonWithChanges');
    returnWithChangesButton.click();
    expect(screen.getAllByText('Return to panel with changes')).toHaveLength(1);
  });
});
