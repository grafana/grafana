import { mount } from 'enzyme';
import React, { FC } from 'react';
import { PAGE_SIZES } from './Pagination.constants';
import { useStoredTablePageSize } from './Pagination.hooks';

const TABLE_ID = 'test-id';
const TABLE_STORAGE_ID = `${TABLE_ID}-table-page-size`;
const DEFAULT_VALUE = PAGE_SIZES[0].value;

const TestComponent: FC = () => {
  const [pageSize, setPageSize] = useStoredTablePageSize(TABLE_ID);

  return (
    <>
      <span>{pageSize}</span>
      <input type="number" value={pageSize} onChange={e => setPageSize(parseInt(e.target.value, 10))} />
    </>
  );
};

const getDataFromLocalStorage = (): number => {
  return +localStorage.getItem(TABLE_STORAGE_ID);
};

const setDataOnLocalStorage = (pageSize: number) => localStorage.setItem(TABLE_STORAGE_ID, `${pageSize}`);

describe('useStoredTablePageSize', () => {
  beforeAll(() => {
    localStorage.removeItem(TABLE_STORAGE_ID);
  });
  afterAll(() => {
    localStorage.removeItem(TABLE_STORAGE_ID);
  });

  it('should initially store the default pageSize', () => {
    mount(<TestComponent />);
    const storedSize = getDataFromLocalStorage();
    expect(storedSize).toBe(DEFAULT_VALUE);
    localStorage.removeItem(TABLE_STORAGE_ID);
  });

  it('should store the size on local storage after input changes', () => {
    const wrapper = mount(<TestComponent />);
    const input = wrapper.find('input').first();
    const value = PAGE_SIZES[1].value;
    input.simulate('change', { target: { value } });
    const storedSize = getDataFromLocalStorage();
    expect(storedSize).toBe(value);
  });

  it('should set the size from previous saves', () => {
    const value = PAGE_SIZES[1].value;
    setDataOnLocalStorage(value);
    const wrapper = mount(<TestComponent />);
    const span = wrapper.find('span').first();
    expect(parseInt(span.text(), 10)).toBe(value);
  });

  it('should set the default if a wrong value is saved', () => {
    localStorage.setItem(TABLE_STORAGE_ID, '1a');
    const wrapper = mount(<TestComponent />);
    const span = wrapper.find('span').first();
    const storedSize = getDataFromLocalStorage();
    expect(parseInt(span.text(), 10)).toBe(DEFAULT_VALUE);
    expect(storedSize).toBe(DEFAULT_VALUE);
  });
});
