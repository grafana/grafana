import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import ContentOutline from './ContentOutline';
import { ContentOutlineContextProvider } from './ContentOutlineContext';

const setup = () => {
  const outlineItemsMock = [
    {
      id: '1',
      title: 'Item 1',
      icon: 'icon1',
      ref: document.createElement('div'),
    },
    {
      id: '2',
      title: 'Item 2',
      icon: 'icon2',
      ref: document.createElement('div'),
    },
  ];
  return render(
    <ContentOutlineContextProvider>
      <ContentOutline outlineItems={outlineItemsMock} />
    </ContentOutlineContextProvider>
  );
};

const scrollIntoViewMock = jest.fn();
HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

describe('<ContentOutline />', () => {
  scrollIntoViewMock.mockClear();
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
    const itemButton = screen.getByLabelText('Item 1');

    fireEvent.click(itemButton);

    // mock the `scrollIntoView` method and assert it's called
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
