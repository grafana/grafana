import { render, screen } from '@testing-library/react';
import React from 'react';

import PageActionBar, { Props } from './PageActionBar';

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    setSearchQuery: jest.fn(),
    target: '_blank',
    linkButton: { href: 'some/url', title: 'test' },
  };

  Object.assign(props, propOverrides);

  return render(<PageActionBar {...props} />);
};

describe('Page action bar test', () => {
  it('should render component', () => {
    setup();

    expect(screen.getByRole('link', { name: 'test' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
