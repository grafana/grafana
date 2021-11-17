import React from 'react';

import { render } from '@testing-library/react';
import { selectors } from '@grafana/e2e-selectors';
import userEvent from '@testing-library/user-event';
import { UnifiedAlertingPromotion, LOCAL_STORAGE_KEY } from './UnifiedAlertingPromotion';

describe('Unified Alerting promotion', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should show by default', () => {
    const promotion = render(<UnifiedAlertingPromotion />);
    console.log(selectors.components.Alert.alertV2('info'));
    expect(promotion.queryByTestId(selectors.components.Alert.alertV2('info'))).toBeInTheDocument();
  });

  it('should be hidden if dismissed', () => {
    const promotion = render(<UnifiedAlertingPromotion />);
    expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBe('true');

    const dismissButton = promotion.getByRole('button');
    userEvent.click(dismissButton);

    expect(promotion.queryByTestId(selectors.components.Alert.alertV2('info'))).not.toBeInTheDocument();
    expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBe('false');
  });

  it('should not render if previously dismissed', () => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, 'false');
    const promotion = render(<UnifiedAlertingPromotion />);

    expect(promotion.queryByTestId(selectors.components.Alert.alertV2('info'))).not.toBeInTheDocument();
  });
});
