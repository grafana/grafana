import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Wizard } from './Wizard';

const MockPage1 = () => <span>Page 1</span>;
const MockPage2 = () => <span>Page 2</span>;
const MockNavigation = () => (
  <span>
    <button type="submit">next</button>
  </span>
);
const onSubmitMock = jest.fn();

describe('Wizard', () => {
  beforeEach(() => {
    render(<Wizard pages={[MockPage1, MockPage2]} navigation={MockNavigation} onSubmit={onSubmitMock} />);
  });

  afterEach(() => {
    onSubmitMock.mockReset();
  });

  it('Renders each page and submits at the end', async () => {
    expect(screen.queryByText('Page 1')).toBeInTheDocument();
    expect(screen.queryByText('Page 2')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /next$/i }));
    expect(onSubmitMock).not.toBeCalled();

    expect(screen.queryByText('Page 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Page 2')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /next$/i }));

    expect(onSubmitMock).toBeCalled();
  });
});
