import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Tooltip } from '../Tooltip';

import { Tag } from './Tag';

describe('Tag', () => {
  test('correctly forwards refs', async () => {
    const user = userEvent.setup();

    render(
      <>
        <Tooltip content="Some content">
          <Tag name="Regular tag" />
        </Tooltip>
        <Tooltip content="Some button content">
          <Tag name="Button tag" onClick={() => {}} />
        </Tooltip>
      </>
    );

    const regularTag = screen.getByText(/regular tag/i);
    await user.hover(regularTag);
    expect(await screen.findByText(/Some content/)).toBeInTheDocument();

    const buttonTag = screen.getByText(/button tag/i);
    await user.hover(buttonTag);
    expect(await screen.findByText(/Some button content/)).toBeInTheDocument();
  });
});
