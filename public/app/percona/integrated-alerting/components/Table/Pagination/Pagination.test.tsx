import React from 'react';
import { mount, shallow } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { Pagination } from './Pagination';
import { Messages } from './Pagination.messages';
import { SelectableValue } from '@grafana/data';

describe('Pagination', () => {
  it('should render at least one page', () => {
    const wrapper = shallow(
      <Pagination totalItems={0} pageCount={1} pageSizeOptions={[]} pageSize={3} nrRowsOnCurrentPage={0} />
    );
    expect(wrapper.find(dataTestId('page-button')).length).toBe(1);
    expect(wrapper.find(dataTestId('page-button')).prop('variant')).toBe('primary');
  });

  it('should disable left navigation buttons when in first page', () => {
    const wrapper = shallow(
      <Pagination totalItems={30} pageCount={10} pageSizeOptions={[]} pageSize={3} nrRowsOnCurrentPage={3} />
    );
    expect(wrapper.find(dataTestId('previous-page-button')).props().disabled).toBeTruthy();
    expect(wrapper.find(dataTestId('first-page-button')).props().disabled).toBeTruthy();
  });

  it('should disable right navigation buttons when in last page', () => {
    const wrapper = shallow(
      <Pagination totalItems={10} pageCount={1} pageSizeOptions={[]} pageSize={10} nrRowsOnCurrentPage={10} />
    );
    expect(wrapper.find(dataTestId('next-page-button')).props().disabled).toBeTruthy();
    expect(wrapper.find(dataTestId('last-page-button')).props().disabled).toBeTruthy();
  });

  it('should enable all navigation buttons while active page is not first or last', () => {
    const wrapper = shallow(
      <Pagination totalItems={30} pageCount={3} pageSizeOptions={[]} pageSize={10} nrRowsOnCurrentPage={10} />
    );
    wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    expect(wrapper.find(dataTestId('previous-page-button')).props().disabled).toBeFalsy();
    expect(wrapper.find(dataTestId('first-page-button')).props().disabled).toBeFalsy();
    expect(wrapper.find(dataTestId('next-page-button')).props().disabled).toBeFalsy();
    expect(wrapper.find(dataTestId('last-page-button')).props().disabled).toBeFalsy();
  });

  it('should show all pages when pagesPerView > totalPages', () => {
    const wrapper = shallow(
      <Pagination
        pagesPerView={25}
        totalItems={10}
        pageCount={4}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    expect(wrapper.find(dataTestId('page-button')).length).toBe(4);
  });

  it('should show "pagesPerView" pages if pageCount > pagesPerView', () => {
    const wrapper = shallow(
      <Pagination
        pagesPerView={5}
        totalItems={100}
        pageCount={10}
        pageSizeOptions={[]}
        pageSize={10}
        nrRowsOnCurrentPage={10}
      />
    );
    expect(wrapper.find(dataTestId('page-button')).length).toBe(5);
  });

  it('should keep the selected page in the center, when pagesPerView is odd and while last page button is not visible', () => {
    const wrapper = shallow(
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
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }
    expect(wrapper.find(dataTestId('page-button')).at(2).text()).toBe('3');
    expect(wrapper.find(dataTestId('page-button')).at(2).prop('variant')).toBe('primary');
    for (let i = 0; i < 2; i++) {
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }
    expect(wrapper.find(dataTestId('page-button')).at(2).text()).toBe('5');
    expect(wrapper.find(dataTestId('page-button')).at(2).prop('variant')).toBe('primary');
  });

  it('should keep the selected page in the center-left, when pagesPerView is even and while last page button is not visible', () => {
    const wrapper = shallow(
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
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }
    expect(wrapper.find(dataTestId('page-button')).at(2).text()).toBe('3');
    expect(wrapper.find(dataTestId('page-button')).at(2).prop('variant')).toBe('primary');
    for (let i = 0; i < 2; i++) {
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }
    expect(wrapper.find(dataTestId('page-button')).at(2).text()).toBe('5');
    expect(wrapper.find(dataTestId('page-button')).at(2).prop('variant')).toBe('primary');
  });

  it('should keep moving from the center when last page button is already visible', () => {
    const wrapper = shallow(
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
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }
    expect(wrapper.find(dataTestId('page-button')).at(2).text()).toBe('5');
    expect(wrapper.find(dataTestId('page-button')).at(2).prop('variant')).toBe('primary');
  });

  it('should correctly show the items interval being shown', () => {
    const wrapper = shallow(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    expect(wrapper.find(dataTestId('pagination-items-inverval')).text()).toBe(
      Messages.getItemsIntervalMessage(1, 3, 15)
    );
    for (let i = 0; i < 2; i++) {
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }
    expect(wrapper.find(dataTestId('pagination-items-inverval')).text()).toBe(
      Messages.getItemsIntervalMessage(7, 9, 15)
    );
  });

  it('should show "showing 0 - 0 of 0 items" when empty', () => {
    const wrapper = shallow(
      <Pagination
        pagesPerView={3}
        totalItems={0}
        pageCount={0}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={0}
      />
    );
    expect(wrapper.find(dataTestId('pagination-items-inverval')).text()).toBe(
      Messages.getItemsIntervalMessage(0, 0, 0)
    );
  });

  it('should trigger a page change', () => {
    const cb = jest.fn();
    const wrapper = shallow(
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
    wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    expect(cb).toBeCalledWith(1);
  });

  it('should not trigger a page change on first page and previous is clicked', () => {
    const cb = jest.fn();
    const wrapper = shallow(
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
    wrapper.find(dataTestId('previous-page-button')).last().simulate('click');
    expect(cb).not.toHaveBeenCalled();
  });

  it('should not trigger a page change if on last page and next is clicked', () => {
    const cb = jest.fn();
    const wrapper = shallow(
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
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }
    expect(cb).toHaveBeenCalledTimes(4);
  });

  it('should jump to last page', () => {
    const wrapper = shallow(
      <Pagination
        pagesPerView={3}
        totalItems={15}
        pageCount={5}
        pageSizeOptions={[]}
        pageSize={3}
        nrRowsOnCurrentPage={3}
      />
    );
    wrapper.find(dataTestId('last-page-button')).simulate('click');

    const activePageButton = wrapper.find(dataTestId('page-button')).last();
    expect(activePageButton.prop('variant')).toBe('primary');
    expect(activePageButton.text()).toBe('5');
  });

  it('should jump to first page', () => {
    const wrapper = shallow(
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
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }
    wrapper.find(dataTestId('first-page-button')).simulate('click');

    const activePageButton = wrapper.find(dataTestId('page-button')).first();
    expect(activePageButton.prop('variant')).toBe('primary');
    expect(activePageButton.text()).toBe('1');
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
    const wrapper = mount(
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
      wrapper.find(dataTestId('next-page-button')).last().simulate('click');
    }

    const input = wrapper.find('input').first();
    input.simulate('keydown', { key: 'ArrowDown' });

    const lastOption = wrapper.find({ 'aria-label': 'Select option' }).last();
    lastOption.simulate('click');
    expect(cb).toHaveBeenCalledWith(100);
    expect(wrapper.find(dataTestId('page-button')).first().prop('variant')).toBe('primary');
  });
});
