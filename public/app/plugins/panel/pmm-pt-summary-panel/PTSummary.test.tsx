import { render, screen } from '@testing-library/react';
import React from 'react';

import { PTSummaryPanel } from './PTSummary';

describe('PTSummaryPanel::', () => {
  it('Renders correctly with props', () => {
    const props: any = {
      data: {
        series: [{ fields: [{ name: 'summary', values: ['Test data'] }] }],
      },
    };
    render(<PTSummaryPanel {...props} />);

    expect(screen.getByTestId('pt-summary-fingerprint')?.textContent).toBe('Test data');
  });

  it('Renders correctly without data', () => {
    const props: any = {
      data: {
        series: [],
      },
    };
    render(<PTSummaryPanel {...props} />);

    expect(screen.getByTestId('pt-summary-fingerprint')?.textContent).toBe('');
  });
});
