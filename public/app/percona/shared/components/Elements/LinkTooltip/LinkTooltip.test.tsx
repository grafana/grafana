import { render } from '@testing-library/react';

import { LinkTooltip } from './LinkTooltip';

const testProps = {
  tooltipText: 'Test text',
  link: 'Test link',
  linkText: 'Test link text',
  dataTestId: 'link-tooltip',
};

describe('LinkTooltip::', () => {
  it('Renders icon correctly', () => {
    const { container } = render(<LinkTooltip icon="question-circle" {...testProps} />);
    expect(container.children).toHaveLength(1);
  });
});
