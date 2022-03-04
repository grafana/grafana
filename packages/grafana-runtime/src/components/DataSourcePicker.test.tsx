import React from 'react';
import { DataSourcePicker } from './DataSourcePicker';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../services/dataSourceSrv');

describe('DataSourcePicker', () => {
  describe('onClear', () => {
    it('should call onClear when function is passed', async () => {
      const onClear = jest.fn();
      const select = render(<DataSourcePicker onClear={onClear} />);

      const clearButton = select.getByLabelText('select-clear-value');
      userEvent.click(clearButton);
      expect(onClear).toHaveBeenCalled();
    });

    it('should not render clear button when no onClear function is passed', async () => {
      const select = render(<DataSourcePicker />);

      expect(() => {
        select.getByLabelText('select-clear-value');
      }).toThrowError();
    });
  });
});
