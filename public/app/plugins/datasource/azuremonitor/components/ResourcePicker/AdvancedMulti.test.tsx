import { render, screen } from '@testing-library/react';
import React from 'react';

import AdvancedMulti from './AdvancedMulti';

describe('AdvancedMulti', () => {
  it('should expand and render a section', async () => {
    const onChange = jest.fn();
    const renderAdvanced = jest.fn().mockReturnValue(<div>details!</div>);
    render(<AdvancedMulti onChange={onChange} resources={[{}]} renderAdvanced={renderAdvanced} />);
    const advancedSection = screen.getByText('Advanced');
    advancedSection.click();

    expect(await screen.findByText('details!')).toBeInTheDocument();
  });
});
