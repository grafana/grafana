import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import ContentOutline from './ContentOutline';

jest.mock('./ContentOutlineContext', () => ({
  useContentOutlineContext: jest.fn(),
}));

const scrollIntoViewMock = jest.fn();

const setup = () => {
  HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

  // Mock useContentOutlineContext with custom outlineItems
  const mockUseContentOutlineContext = require('./ContentOutlineContext').useContentOutlineContext;
  mockUseContentOutlineContext.mockReturnValue({
    outlineItems: [
      {
        id: 'item-1',
        icon: 'test-icon',
        title: 'Item 1',
        ref: document.createElement('div'),
      },
      {
        id: 'item-2',
        icon: 'test-icon',
        title: 'Item 2',
        ref: document.createElement('div'),
      },
    ],
    register: jest.fn(),
    unregister: jest.fn(),
  });

  return render(<ContentOutline />);
};

describe('<ContentOutline />', () => {
  beforeEach(() => {
    setup();
  });

  it('toggles content on button click', () => {
    let showContentOutlineButton = screen.getByLabelText('Show Content Outline');
    expect(showContentOutlineButton).toBeInTheDocument();

    fireEvent.click(showContentOutlineButton);
    const hideContentOutlineButton = screen.getByText('Hide Content Outline');
    expect(hideContentOutlineButton).toBeInTheDocument();

    fireEvent.click(hideContentOutlineButton);
    showContentOutlineButton = screen.getByLabelText('Show Content Outline');
    expect(showContentOutlineButton).toBeInTheDocument();
  });

  it('scrolls into view on content button click', () => {
    const itemButtons = screen.getAllByLabelText(/Item/i);

    itemButtons.forEach((button) => {
      scrollIntoViewMock.mockClear();

      fireEvent.click(button);

      //assert scrollIntoView is called
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});
