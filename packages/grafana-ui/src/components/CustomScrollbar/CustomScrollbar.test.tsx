import { render } from '@testing-library/react';

import { CustomScrollbar } from './CustomScrollbar';

describe('CustomScrollbar', () => {
  it('renders correctly', () => {
    const { container } = render(
      <CustomScrollbar>
        <p>Scrollable content</p>
      </CustomScrollbar>
    );
    expect(container).toMatchSnapshot();
  });
});
