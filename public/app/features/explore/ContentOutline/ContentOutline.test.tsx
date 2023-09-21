import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';

import ContentOutline from './ContentOutline';
import { ContentOutlineContextProvider } from './ContentOutlineContext'; // Assuming you have a provider

const setup = () => {
  const outlineItemsMock = [
    { id: '1', title: 'Item 1', icon: 'icon1', ref: document.createElement('div') },
    { id: '2', title: 'Item 2', icon: 'icon2', ref: document.createElement('div') },
  ];
  return render(
    <ContentOutlineContextProvider>
      <ContentOutline outlineItems={outlineItemsMock} />
    </ContentOutlineContextProvider>
  );
};

describe('<ContentOutline />', () => {
  beforeEach(() => {
    setup();
  });

  it('toggles content on button click', () => {
    const toggleButton = screen.getByText(/Hide Content Outline/);
    expect(toggleButton).not.toBeInTheDocument();

    const collapsedButton = screen.getByText('');
    fireEvent.click(collapsedButton);
    expect(screen.getByText(/Hide Content Outline/)).toBeInTheDocument();
  });

  it('scrolls into view on content button click', () => {
    const itemButton = screen.getByText('Item 1');

    act(() => {
      fireEvent.click(itemButton);
    });
    // mock the `scrollIntoView` method and assert it's called
    document.documentElement.scrollIntoView = jest.fn();
    expect(document.documentElement.scrollIntoView).toHaveBeenCalled();
  });

  // it('shows tooltip when content is collapsed', () => {
  //   const itemButton = screen.getByText('Item 1');
  //   // Check for tooltip
  // });
});
