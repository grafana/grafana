import { render, screen } from '@testing-library/react';
import React from 'react';

import { Label } from './SectionLabel';

describe('SectionLabel', () => {
  test('renders SectionLabel with expiry date', async () => {
    render(<Label name="Expiry Date" endDate="28/10/2019" />);

    expect(screen.getByText(/Expiry date: 28\/10\/2019/i)).toBeInTheDocument();
  });
});
