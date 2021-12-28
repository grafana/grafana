import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedAlertingPromotion, LOCAL_STORAGE_KEY } from './UnifiedAlertingPromotion';

describe('Unified Alerting promotion', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should show by default', () => {
    render(<UnifiedAlertingPromotion />);
    expect(screen.queryByText('Try out the Grafana 8 alerting!')).toBeInTheDocument();
  });

  it('should be hidden if dismissed', () => {
    const promotion = render(<UnifiedAlertingPromotion />);
    expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBe('true');

    const dismissButton = promotion.getByRole('button');
    userEvent.click(dismissButton);

    expect(screen.queryByText('Try out the Grafana 8 alerting!')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBe('false');
  });

  it('should not render if previously dismissed', () => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, 'false');
    render(<UnifiedAlertingPromotion />);

    expect(screen.queryByText('Try out the Grafana 8 alerting!')).not.toBeInTheDocument();
  });
});
