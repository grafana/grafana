import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ContentOutline } from './ContentOutline';

jest.mock('./ContentOutlineContext', () => ({
  useContentOutlineContext: jest.fn(),
}));

const scrollIntoViewMock = jest.fn();
const scrollerMock = document.createElement('div');

const setup = (mergeSingleChild = false) => {
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
        mergeSingleChild,
        children: [
          {
            id: 'item-1-1',
            icon: 'test-icon',
            title: 'Item 1-1',
            ref: document.createElement('div'),
            level: 'child',
          },
        ],
      },
      {
        id: 'item-2',
        icon: 'test-icon',
        title: 'Item 2',
        ref: document.createElement('div'),
        mergeSingleChild,
        children: [
          {
            id: 'item-2-1',
            icon: 'test-icon',
            title: 'Item 2-1',
            ref: document.createElement('div'),
            level: 'child',
          },
          {
            id: 'item-2-2',
            icon: 'test-icon',
            title: 'Item 2-2',
            ref: document.createElement('div'),
            level: 'child',
          },
        ],
      },
    ],
    register: jest.fn(),
    unregister: jest.fn(),
  });

  return render(<ContentOutline scroller={scrollerMock} panelId="content-outline-container-1" />);
};

describe('<ContentOutline />', () => {
  it('toggles content on button click', () => {
    setup();
    let showContentOutlineButton = screen.getByLabelText('Expand outline');
    expect(showContentOutlineButton).toBeInTheDocument();

    fireEvent.click(showContentOutlineButton);
    const hideContentOutlineButton = screen.getByLabelText('Collapse outline');
    expect(hideContentOutlineButton).toBeInTheDocument();

    fireEvent.click(hideContentOutlineButton);
    showContentOutlineButton = screen.getByLabelText('Expand outline');
    expect(showContentOutlineButton).toBeInTheDocument();
  });

  it('scrolls into view on content button click', () => {
    setup();
    const itemButtons = screen.getAllByLabelText(/Item/i);

    itemButtons.forEach((button) => {
      fireEvent.click(button);

      //assert scrollIntoView is called
      expect(scrollerMock.scroll).toHaveBeenCalled();
    });
  });

  it('doesnt merge a single child item when mergeSingleChild is false', async () => {
    setup();
    const expandSectonChevron = screen.getAllByTitle('angle-right');
    await userEvent.click(expandSectonChevron[0]);

    const child = screen.getByLabelText('Item 1-1');
    expect(child).toBeInTheDocument();
  });

  it('merges a single child item when mergeSingleChild is true', () => {
    setup(true);
    const child = screen.queryByText('Item 1-1');

    expect(child).not.toBeInTheDocument();
  });

  it('displays multiple children', async () => {
    setup();
    const expandSectonChevron = screen.getAllByTitle('angle-right');
    await userEvent.click(expandSectonChevron[1]);

    const child1 = screen.getByLabelText('Item 2-1');
    const child2 = screen.getByLabelText('Item 2-2');
    expect(child1).toBeInTheDocument();
    expect(child2).toBeInTheDocument();
  });

  it('if item has multiple children, it displays multiple children when mergeSingleChild is true', async () => {
    setup(true);
    const expandSectonChevron = screen.getAllByTitle('angle-right');
    // since first item has only one child, we will have only one chevron
    await userEvent.click(expandSectonChevron[0]);

    const child1 = screen.getByLabelText('Item 2-1');
    const child2 = screen.getByLabelText('Item 2-2');
    expect(child1).toBeInTheDocument();
    expect(child2).toBeInTheDocument();
  });
});
