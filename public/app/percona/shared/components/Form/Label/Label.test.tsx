import { render, screen } from '@testing-library/react';

import { Label } from './Label';

describe('Label', () => {
  it('should render', () => {
    render(<Label dataTestId="test-label" label="label" />);
    expect(screen.getByTestId('test-label')).toBeInTheDocument();
  });
});
