import { render, screen } from '@testing-library/react';

import { VariableTextField } from './VariableTextField';

describe('VariableTextField', () => {
  it('should mark the label with an asterisk when the field is required', () => {
    render(<VariableTextField name="Name" required />);

    expect(screen.getByText('Name *')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('should not mark the label when the field is optional', () => {
    render(<VariableTextField name="Label" />);

    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.queryByText('Label *')).not.toBeInTheDocument();
  });
});
