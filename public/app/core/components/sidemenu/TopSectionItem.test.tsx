import React from 'react';
import { render, screen } from '@testing-library/react';
import TopSectionItem from './TopSectionItem';
import { MemoryRouter } from 'react-router-dom';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      link: {
        text: 'Hello',
        icon: 'cloud',
        url: '/asd',
      },
    },
    propOverrides
  );

  return render(
    <MemoryRouter initialEntries={[{ pathname: '/', key: 'testKey' }]}>
      <TopSectionItem {...props} />
    </MemoryRouter>
  );
};

describe('Render', () => {
  it('should render component', () => {
    setup();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByRole('menu')).toHaveTextContent('Hello');
  });
});
