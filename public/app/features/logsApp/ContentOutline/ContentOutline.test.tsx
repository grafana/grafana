import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { ContentOutline } from './ContentOutline';

jest.mock('./ContentOutlineContext', () => ({
  useContentOutlineContext: jest.fn(),
}));

const scrollIntoViewMock = jest.fn();
const scrollerMock = document.createElement('div');

const setup = () => {
  HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

  scrollerMock.scroll = jest.fn();

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

  return render(<ContentOutline scroller={scrollerMock} panelId="content-outline-container-1" />);
};

describe('<ContentOutline />', () => {
  beforeEach(() => {
    setup();
  });

  it('toggles content on button click', () => {
    let showContentOutlineButton = screen.getByLabelText('Expand content outline');
    expect(showContentOutlineButton).toBeInTheDocument();

    fireEvent.click(showContentOutlineButton);
    const hideContentOutlineButton = screen.getByText('Collapse outline');
    expect(hideContentOutlineButton).toBeInTheDocument();

    fireEvent.click(hideContentOutlineButton);
    showContentOutlineButton = screen.getByLabelText('Expand content outline');
    expect(showContentOutlineButton).toBeInTheDocument();
  });

  it('scrolls into view on content button click', () => {
    const itemButtons = screen.getAllByLabelText(/Item/i);

    itemButtons.forEach((button) => {
      fireEvent.click(button);

      //assert scrollIntoView is called
      expect(scrollerMock.scroll).toHaveBeenCalled();
    });
  });
});
