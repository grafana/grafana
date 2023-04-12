import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourcePicker } from './DataSourcePicker';

jest.mock('@grafana/runtime/src/services/dataSourceSrv');

describe('DataSourcePicker', () => {
  describe('onClear', () => {
    it('should call onClear when function is passed', async () => {
      const onClear = jest.fn();
      const select = render(<DataSourcePicker onClear={onClear} />);

      const clearButton = select.getByLabelText('select-clear-value');
      await userEvent.click(clearButton);
      expect(onClear).toHaveBeenCalled();
    });

    it('should not render clear button when no onClear function is passed', async () => {
      const select = render(<DataSourcePicker />);

      expect(() => {
        select.getByLabelText('select-clear-value');
      }).toThrowError();
    });

    it('should pass disabled prop', async () => {
      render(<DataSourcePicker disabled={true} />);

      const input = screen.getByLabelText('Select a data source');
      expect(input).toHaveProperty('disabled', true);
    });
  });
});
