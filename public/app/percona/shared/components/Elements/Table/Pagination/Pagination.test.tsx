import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { SelectableValue } from '@grafana/data';

import { Pagination } from './Pagination';
import { Messages } from './Pagination.messages';

describe('Pagination', () => {
  it('should render at least one page', () => {
    render(<Pagination totalItems={0} pageCount={1} pageSizeOptions={[]} pageSize={3} nrRowsOnCurrentPage={0} />);
    expect(screen.getByTestId('page-button-active')).toBeInTheDocument();
    expect(screen.queryByTestId('page-button')).not.toBeInTheDocument();
  });

  it('should disable left navigation buttons when in first page', () => {
    render(<Pagination totalItems={30} pageCount={10} pageSizeOptions={[]} pageSize={3} nrRowsOnCurrentPage={3} />);
    expect(screen.getByTestId('previous-page-button')).toBeDisabled();
    expect(screen.getByTestId('first-page-button')).toBeDisabled();
  });

  it('should disable right navigation buttons when in last page', () => {
    render(<Pagination totalItems={10} pageCount={1} pageSizeOptions={[]} pageSize={10} nrRowsOnCurrentPage={10} />);
    expect(screen.getByTestId('next-page-button')).toBeDisabled();
    expect(screen.getByTestId('last-page-button')).toBeDisabled();
  });

  it('should enable all navigation buttons while active page is not first or last', () => {
    render(<Pagination totalItems={30} pageCount={3} pageSizeOptions={[]} pageSize={10} nrRowsOnCurrentPage={10} />);
    const nextPageButton = screen.getByTestId('next-page-button');
    fireEvent.click(nextPageButton);

    expect(screen.getByTestId('previous-page-button')).not.toBeDisabled();
    expect(screen.getByTestId('first-page-button')).not.toBeDisabled();
    expect(screen.getByTestId('next-page-button')).not.toBeDisabled();
    expect(screen.getByTestId('last-page-button')).not.toBeDisabled();
  });

  it('should show all pages when pagesPerView > totalPages', () => {
    render(
      <Pagination
        pagesPerView={25}
        totalItems={10}
        pageCount={4}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    expect(screen.getAllByTestId('page-button')).toHaveLength(3);
    expect(screen.getAllByTestId('page-button-active')).toHaveLength(1);
  });

  it('should show "pagesPerView" pages if pageCount > pagesPerView', () => {
    render(
      <Pagination
        pagesPerView={5}
        totalItems={100}
        pageCount={10}
        pageSizeOptions={[]}
        pageSize={10}
        nrRowsOnCurrentPage={10}
      />
    );
    expect(screen.getAllByTestId('page-button')).toHaveLength(4);
    expect(screen.getAllByTestId('page-button-active')).toHaveLength(1);
  });

  it('should keep the selected page in the center, when pagesPerView is odd and while last page button is not visible', async () => {
    render(
      <Pagination
        pagesPerView={5}
        totalItems={20}
        pageCount={7}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    // There's 7 pages, meaning two clicks will get us to page 3, in the very center
    // Two more clicks should bring 4 and 5 to the center as well
    for (let i = 0; i < 2; i++) {
      const btn = screen.getByTestId('next-page-button');
      await waitFor(() => fireEvent.click(btn));
    }
    expect(screen.getByTestId('page-button-active')).toHaveTextContent('3');

    for (let i = 0; i < 2; i++) {
      const btn = screen.getByTestId('next-page-button');
      await waitFor(() => fireEvent.click(btn));
    }
    expect(screen.getByTestId('page-button-active')).toHaveTextContent('5');
  });

  it('should keep the selected page in the center-left, when pagesPerView is even and while last page button is not visible', async () => {
    render(
      <Pagination
        pagesPerView={6}
        totalItems={80}
        pageCount={8}
        pageSizeOptions={[]}
        pageSize={10}
        nrRowsOnCurrentPage={10}
      />
    );
    // There's 8 pages, meaning two clicks will get us to page 3, in the center-left
    // Two more clicks should bring 4 and 5 to that same position
    for (let i = 0; i < 2; i++) {
      const btn = screen.getByTestId('next-page-button');
      await waitFor(() => fireEvent.click(btn));
    }
    expect(screen.getByTestId('page-button-active')).toHaveTextContent('3');

    for (let i = 0; i < 2; i++) {
      const btn = screen.getByTestId('next-page-button');
      await waitFor(() => fireEvent.click(btn));
    }
    expect(screen.getByTestId('page-button-active')).toHaveTextContent('5');
  });

  it('should keep moving from the center when last page button is already visible', async () => {
    render(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    // There's 5 pages and 3 pages/view, meaning two clicks will bring the last page button into the view
    // After that, any click should move the active page button towards the end, instead of keeping in the center
    // That means that with 4 clicks, we should have page 5 selected on the right
    for (let i = 0; i < 4; i++) {
      const btn = screen.getByTestId('next-page-button');
      await waitFor(() => fireEvent.click(btn));
    }
    expect(screen.getByTestId('page-button-active')).toHaveTextContent('5');
  });

  it('should correctly show the items interval being shown', async () => {
    render(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    expect(screen.getByTestId('pagination-items-inverval')).toHaveTextContent(
      Messages.getItemsIntervalMessage(1, 3, 15)
    );
    for (let i = 0; i < 2; i++) {
      const btn = screen.getByTestId('next-page-button');
      await waitFor(() => fireEvent.click(btn));
    }
    expect(screen.getByTestId('pagination-items-inverval')).toHaveTextContent(
      Messages.getItemsIntervalMessage(7, 9, 15)
    );
  });

  it('should show "showing 0 - 0 of 0 items" when empty', () => {
    render(
      <Pagination
        pagesPerView={3}
        totalItems={0}
        pageCount={0}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={0}
      />
    );
    expect(screen.getByTestId('pagination-items-inverval')).toHaveTextContent(
      Messages.getItemsIntervalMessage(0, 0, 0)
    );
  });

  it('should trigger a page change', () => {
    const cb = jest.fn();
    render(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
        onPageChange={cb}
      />
    );
    const btn = screen.getByTestId('next-page-button');
    fireEvent.click(btn);
    expect(cb).toBeCalledWith(1);
  });

  it('should not trigger a page change on first page and previous is clicked', () => {
    const cb = jest.fn();
    render(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
        onPageChange={cb}
      />
    );
    const btn = screen.getByTestId('previous-page-button');
    fireEvent.click(btn);
    expect(cb).not.toHaveBeenCalled();
  });

  it('should not trigger a page change if on last page and next is clicked', () => {
    const cb = jest.fn();
    render(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
        onPageChange={cb}
      />
    );
    for (let i = 0; i < 5; i++) {
      const btn = screen.getByTestId('next-page-button');
      fireEvent.click(btn);
    }
    expect(cb).toHaveBeenCalledTimes(4);
  });

  it('should jump to last page', () => {
    render(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    const btn = screen.getByTestId('last-page-button');
    fireEvent.click(btn);

    expect(screen.getByTestId('page-button-active')).toHaveTextContent('5');
  });

  it('should jump to first page', () => {
    render(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    for (let i = 0; i < 5; i++) {
      const btn = screen.getByTestId('next-page-button');
      fireEvent.click(btn);
    }
    const btn = screen.getByTestId('first-page-button');
    fireEvent.click(btn);

    expect(screen.getByTestId('page-button-active')).toHaveTextContent('1');
  });

  it('should go to first page after page size changes', () => {
    const cb = jest.fn();
    const options: Array<SelectableValue<number>> = [
      {
        label: '50',
        value: 50,
      },
      {
        label: '100',
        value: 100,
      },
    ];
    render(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={options}
        pageSize={3}
        nrRowsOnCurrentPage={3}
        onPageChange={jest.fn()}
        onPageSizeChange={cb}
      />
    );
    for (let i = 0; i < 5; i++) {
      const btn = screen.getByTestId('next-page-button');
      fireEvent.click(btn);
    }

    const input = screen.getAllByRole('combobox')[0];

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const option = screen.getByTestId('100-select-option');
    fireEvent.click(option);

    expect(cb).toHaveBeenCalledWith(100);
    expect(screen.getByTestId('page-button-active')).toHaveTextContent('1');
  });
});
