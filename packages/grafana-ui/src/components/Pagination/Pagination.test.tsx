import React from 'react';
import { Pagination } from './Pagination';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getPageButton = async (page: number) => {
  return await screen.queryByText(`${page}`);
};
const getNextButton = async () => {
  return await screen.getByLabelText('next');
};
const getPreviousButton = async () => {
  return await screen.getByLabelText('previous');
};
const getAllPaginationElements = async () => {
  return await screen.findAllByRole('listitem');
};

describe('Pagination', () => {
  let currentPage = 1;
  const onNavigate = (page: number) => {
    currentPage = page;
  };
  const MAX_ELEMENTS = 11;
  it('renders the correct number of pages', async () => {
    render(<Pagination numberOfPages={3} currentPage={currentPage} onNavigate={onNavigate} />);
    const listItems = await getAllPaginationElements();
    expect(listItems.length).toEqual(5);
  });

  it('renders the condensed version for a large number of pages', async () => {
    render(<Pagination numberOfPages={100} currentPage={currentPage} onNavigate={onNavigate} />);
    const listItems = await getAllPaginationElements();
    expect(listItems.length).toEqual(MAX_ELEMENTS);
  });

  it('increments the page', async () => {
    currentPage = 9;
    render(<Pagination numberOfPages={13} currentPage={currentPage} onNavigate={onNavigate} />);
    const nextButton = await getNextButton();

    await userEvent.click(nextButton);
    expect(currentPage).toEqual(10);
  });

  it('decrements the page', async () => {
    currentPage = 9;
    render(<Pagination numberOfPages={13} currentPage={currentPage} onNavigate={onNavigate} />);
    const previousButton = await getPreviousButton();

    await userEvent.click(previousButton);
    expect(currentPage).toEqual(8);
  });

  it('navigates to a specific page when clicking', async () => {
    currentPage = 1;
    render(<Pagination numberOfPages={25} currentPage={currentPage} onNavigate={onNavigate} />);
    const buttonSeven = await screen.findByText('7');
    userEvent.click(buttonSeven);
    expect(currentPage).toEqual(7);
  });

  it('does not render condensed pages', async () => {
    currentPage = 1;
    render(<Pagination numberOfPages={25} currentPage={currentPage} onNavigate={onNavigate} />);

    const button = await getPageButton(24);
    expect(button).toBeNull();
  });

  it('always renders the same number of elements for large number of pages', async () => {
    currentPage = 60;
    const { rerender } = render(<Pagination numberOfPages={100} currentPage={currentPage} onNavigate={onNavigate} />);

    const pageListItems = await getAllPaginationElements();
    expect(pageListItems.length).toEqual(MAX_ELEMENTS);

    rerender(<Pagination numberOfPages={50} currentPage={50} onNavigate={onNavigate} />);

    const pages = await getAllPaginationElements();
    expect(pages.length).toEqual(MAX_ELEMENTS);
  });

  it('renders the two next and two previous pages in condensed view', async () => {
    currentPage = 12;
    const numberOfPages = 25;

    render(<Pagination numberOfPages={numberOfPages} currentPage={currentPage} onNavigate={onNavigate} />);
    const lowerMiddleButton = await getPageButton(currentPage - 2);
    const upperMiddleButton = await getPageButton(currentPage + 2);
    const firstPage = await getPageButton(1);
    const lastPage = await getPageButton(numberOfPages);

    expect(lowerMiddleButton).not.toBeNull();
    expect(upperMiddleButton).not.toBeNull();
    expect(firstPage).not.toBeNull();
    expect(lastPage).not.toBeNull();
  });

  it('shows only relevant pages near beginning of page list', async () => {
    currentPage = 1;
    const numberOfPages = 12;
    render(<Pagination numberOfPages={numberOfPages} currentPage={currentPage} onNavigate={onNavigate} />);

    const seventhPage = await getPageButton(7);
    const eighthPage = await getPageButton(8);
    const lastPage = await getPageButton(numberOfPages);
    const listItems = await getAllPaginationElements();

    expect(seventhPage).not.toBeNull();
    expect(eighthPage).toBeNull();
    expect(lastPage).not.toBeNull();
    expect(listItems.length).toEqual(MAX_ELEMENTS);
  });

  it('shows only relevant pages near end of page list', async () => {
    currentPage = 11;
    const numberOfPages = 12;
    render(<Pagination numberOfPages={numberOfPages} currentPage={currentPage} onNavigate={onNavigate} />);

    const fifthPage = await getPageButton(5);
    const sixthPage = await getPageButton(6);
    const firstPage = await getPageButton(1);
    const listItems = await getAllPaginationElements();

    expect(fifthPage).toBeNull();
    expect(sixthPage).not.toBeNull();
    expect(firstPage).not.toBeNull();
    expect(listItems.length).toEqual(MAX_ELEMENTS);
  });
});
