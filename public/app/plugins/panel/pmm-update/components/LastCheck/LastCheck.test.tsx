import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';

import { LastCheck } from './LastCheck';

describe('LastCheck::', () => {
  const lastCheckDate = '12345';
  const fakeHandleClick = jest.fn();

  beforeEach(() => {
    fakeHandleClick.mockClear();
  });

  it('should show the passed last check date', () => {
    const container = render(<LastCheck onCheckForUpdates={fakeHandleClick} lastCheckDate={lastCheckDate} />);

    expect(container.baseElement.textContent).toEqual(`Last check: ${lastCheckDate}`);
  });

  it('should call the passed onClick handler on Button click', () => {
    render(<LastCheck onCheckForUpdates={fakeHandleClick} lastCheckDate={lastCheckDate} />);

    fireEvent.click(screen.getByTestId('update-last-check-button'));

    expect(fakeHandleClick).toHaveBeenCalledTimes(1);
  });
});
