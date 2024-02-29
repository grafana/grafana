import { render, screen } from '@testing-library/react';
import React from 'react';

import { RichHistorySettingsTab, RichHistorySettingsProps } from './RichHistorySettingsTab';

const setup = (propOverrides?: Partial<RichHistorySettingsProps>) => {
  const props: RichHistorySettingsProps = {
    retentionPeriod: 14,
    starredTabAsFirstTab: true,
    activeDatasourcesOnly: false,
    onChangeRetentionPeriod: jest.fn(),
    toggleStarredTabAsFirstTab: jest.fn(),
    toggleactiveDatasourcesOnly: jest.fn(),
    deleteRichHistory: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return render(<RichHistorySettingsTab {...props} />);
};

describe('RichHistorySettings', () => {
  it('should render component with correct retention period', () => {
    setup();
    expect(screen.queryByText('2 weeks')).toBeInTheDocument();
  });
  it('should render component with correctly checked starredTabAsFirstTab and uncheched toggleactiveDatasourcesOnly settings', () => {
    setup();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[0]).toHaveAttribute('checked');
    expect(checkboxes[1]).not.toHaveAttribute('checked');
  });
});
