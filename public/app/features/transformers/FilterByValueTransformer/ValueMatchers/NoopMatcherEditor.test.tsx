import { render } from '@testing-library/react';

import { NoopMatcherEditor } from './NoopMatcherEditor';

describe('NoopMatcherEditor', () => {
  it('renders nothing', () => {
    const { container } = render(<NoopMatcherEditor />);
    expect(container).toBeEmptyDOMElement();
  });
});
