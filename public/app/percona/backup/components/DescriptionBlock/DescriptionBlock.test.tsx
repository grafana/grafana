import React from 'react';
import { DescriptionBlock } from './DescriptionBlock';
import { render } from '@testing-library/react';

describe('DescriptionBlock', () => {
  it('should render description', () => {
    const { container } = render(<DescriptionBlock description="sample_description" />);
    expect(container.querySelector('pre')).toHaveTextContent('sample_description');
  });
});
