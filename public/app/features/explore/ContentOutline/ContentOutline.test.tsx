import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { store } from '@grafana/data';

import { ContentOutline } from './ContentOutline';

jest.mock('./ContentOutlineContext', () => ({
  useContentOutlineContext: jest.fn(),
}));

const scrollIntoViewMock = jest.fn();
const scrollerMock = document.createElement('div');

const unregisterMock = jest.fn();

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
            onRemove: () => unregisterMock('item-2-1'),
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
    unregister: unregisterMock,
  });

  return render(<ContentOutline scroller={scrollerMock} panelId="content-outline-container-1" />);
};

describe('<ContentOutline />', () => {
  it('toggles content on button click', async () => {
    setup();
    let showContentOutlineButton = screen.getByRole('button', { name: 'Collapse outline' });
    expect(showContentOutlineButton).toBeInTheDocument();

    await userEvent.click(showContentOutlineButton);
    const hideContentOutlineButton = screen.getByRole('button', { name: 'Expand outline' });
    expect(hideContentOutlineButton).toBeInTheDocument();

    await userEvent.click(hideContentOutlineButton);
    showContentOutlineButton = screen.getByRole('button', { name: 'Collapse outline' });
    expect(showContentOutlineButton).toBeInTheDocument();
  });

  it('scrolls into view on content button click', async () => {
    setup();
    const itemButtons = screen.getAllByRole('button', { name: /Item [0-9]+/ });

    for (const button of itemButtons) {
      await userEvent.click(button);
    }

    expect(scrollerMock.scroll).toHaveBeenCalledTimes(itemButtons.length);
  });

  it('doesnt merge a single child item when mergeSingleChild is false', async () => {
    setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    await userEvent.click(expandSectionChevrons[0]);

    const child = screen.getByRole('button', { name: 'Item 1-1' });
    expect(child).toBeInTheDocument();
  });

  it('merges a single child item when mergeSingleChild is true', () => {
    setup(true);
    const child = screen.queryByRole('button', { name: 'Item 1-1' });

    expect(child).not.toBeInTheDocument();
  });

  it('displays multiple children', async () => {
    setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    await userEvent.click(expandSectionChevrons[1]);

    const child1 = screen.getByRole('button', { name: 'Item 2-1' });
    const child2 = screen.getByRole('button', { name: 'Item 2-2' });
    expect(child1).toBeInTheDocument();
    expect(child2).toBeInTheDocument();
  });

  it('if item has multiple children, it displays multiple children even when mergeSingleChild is true', async () => {
    setup(true);
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    // since first item has only one child, we will have only one chevron
    await userEvent.click(expandSectionChevrons[0]);

    const child1 = screen.getByRole('button', { name: 'Item 2-1' });
    const child2 = screen.getByRole('button', { name: 'Item 2-2' });
    expect(child1).toBeInTheDocument();
    expect(child2).toBeInTheDocument();
  });

  it('collapse button has same aria-controls as the section content', async () => {
    setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    // chevron for the second item
    const button = expandSectionChevrons[1];
    // content for the second item
    const sectionContent = screen.getByTestId('section-wrapper-item-2');
    await userEvent.click(button);
    expect(button.getAttribute('aria-controls')).toBe(sectionContent.id);
  });

  it('deletes item on delete button click', async () => {
    setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    // chevron for the second item
    const button = expandSectionChevrons[1];
    await userEvent.click(button);
    const deleteButtons = screen.getAllByTestId('content-outline-item-delete-button');
    await userEvent.click(deleteButtons[0]);

    expect(unregisterMock).toHaveBeenCalledWith('item-2-1');
  });

  it('should retrieve the last expanded state from local storage', async () => {
    const getBoolMock = jest.spyOn(store, 'getBool').mockReturnValue(false);
    setup();
    const collapseContentOutlineButton = screen.queryByRole('button', { name: 'Collapse outline' });
    const expandContentOutlineButton = screen.queryByRole('button', { name: 'Expand outline' });
    expect(collapseContentOutlineButton).not.toBeInTheDocument();
    expect(expandContentOutlineButton).toBeInTheDocument();

    getBoolMock.mockRestore();
  });
});
