import { render, fireEvent } from '@testing-library/react';
import React, { FC } from 'react';

import { PAGE_SIZES } from './Pagination.constants';
import { useStoredTablePageSize } from './Pagination.hooks';

const TABLE_ID = 'test-id';
const TABLE_STORAGE_ID = `${TABLE_ID}-table-page-size`;
const DEFAULT_VALUE = PAGE_SIZES[0].value;

const TestComponent: FC<React.PropsWithChildren<unknown>> = () => {
  const [pageSize, setPageSize] = useStoredTablePageSize(TABLE_ID);

  return (
    <>
      <span>{pageSize}</span>
      <input type="number" value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value, 10))} />
    </>
  );
};

const getDataFromLocalStorage = (): number => {
  return parseInt(localStorage.getItem(TABLE_STORAGE_ID) || '0', 10);
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
    render(<TestComponent />);
    const storedSize = getDataFromLocalStorage();
    expect(storedSize).toBe(DEFAULT_VALUE);
    localStorage.removeItem(TABLE_STORAGE_ID);
  });

  it('should store the size on local storage after input changes', () => {
    const { container } = render(<TestComponent />);
    const input = container.querySelectorAll('input')[0];
    const value = PAGE_SIZES[1].value;
    fireEvent.change(input, { target: { value } });
    const storedSize = getDataFromLocalStorage();
    expect(storedSize).toBe(value);
  });

  it('should set the size from previous saves', () => {
    const value = PAGE_SIZES[1].value || 0;
    setDataOnLocalStorage(value);
    const { container } = render(<TestComponent />);
    const span = container.querySelectorAll('span')[0];
    expect(span).toHaveTextContent(value.toString());
  });

  it('should set the default if a wrong value is saved', () => {
    localStorage.setItem(TABLE_STORAGE_ID, '1a');
    const { container } = render(<TestComponent />);
    const spanText = container.querySelectorAll('span')[0].textContent;
    const storedSize = getDataFromLocalStorage();
    expect(spanText ? +spanText : spanText).toBe(DEFAULT_VALUE);
    expect(storedSize).toBe(DEFAULT_VALUE);
  });
});
