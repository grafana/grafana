import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs';
import React from 'react';

import { News } from './News';

const setup = () => {
  const { container } = render(<News />);

  return { container };
};

describe('News', () => {
  const result = fs.readFileSync(`${__dirname}/fixtures/news.xml`, 'utf8');
  beforeEach(() => {
    jest.resetAllMocks();
    window.fetch = jest.fn().mockResolvedValue({ text: () => result });
  });

  it('should render the drawer when the drawer button is clicked', async () => {
    setup();

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.example.net/2022/02/10/something-fake/');
  });
});
