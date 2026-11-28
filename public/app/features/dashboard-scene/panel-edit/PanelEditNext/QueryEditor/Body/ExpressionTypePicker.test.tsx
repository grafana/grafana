import { screen } from '@testing-library/react';

import { renderWithQueryEditorProvider } from '../testUtils';

import { ExpressionTypePicker } from './ExpressionTypePicker';

describe('ExpressionTypePicker', () => {
  it('describes each expression card button with its description', () => {
    renderWithQueryEditorProvider(<ExpressionTypePicker />);

    expect(screen.getByRole('button', { name: 'Math' })).toHaveAccessibleDescription(
      'Free-form math formulas on time series or number data.'
    );
  });
});
