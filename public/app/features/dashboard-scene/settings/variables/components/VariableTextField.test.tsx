import { render, screen } from '@testing-library/react';

import { VariableTextField } from './VariableTextField';

describe('VariableTextField', () => {
  it('marks required fields with an asterisk on the label', () => {
    render(<VariableTextField name="Name" required defaultValue="" />);

    expect(screen.getByText('Name *')).toBeInTheDocument();
  });

  it('does not mark optional fields as required', () => {
    render(<VariableTextField name="Label" defaultValue="" />);

    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.queryByText('Label *')).not.toBeInTheDocument();
  });
});
