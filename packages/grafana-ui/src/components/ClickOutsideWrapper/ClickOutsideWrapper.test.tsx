import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClickOutsideWrapper } from './ClickOutsideWrapper';

describe('ClickOutsideWrapper', () => {
  it('should call callback when clicked outside', async () => {
    let clickedOutside = false;
    render(
      <div>
        <ClickOutsideWrapper
          onClick={() => {
            clickedOutside = true;
          }}
        >
          Click Outside
        </ClickOutsideWrapper>
        <button>Click me</button>
      </div>
    );

    const button = screen.getByText('Click me');
    await userEvent.click(button);
    expect(clickedOutside).toBe(true);
  });
});
