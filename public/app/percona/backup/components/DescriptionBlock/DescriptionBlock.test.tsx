import { render } from '@testing-library/react';

import { DescriptionBlock } from './DescriptionBlock';

describe('DescriptionBlock', () => {
  it('should render description', () => {
    const { container } = render(<DescriptionBlock description="sample_description" />);
    expect(container.querySelector('pre')).toHaveTextContent('sample_description');
  });
});
