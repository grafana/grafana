import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourcePicker } from './DataSourcePicker';

jest.mock('../services/dataSourceSrv', () => ({
  getDataSourceSrv: () => ({
    getList: () => [],
    getInstanceSettings: () => undefined,
    get: () => undefined,
  }),
}));

describe('DataSourcePicker', () => {
  describe('onClear', () => {
    it('should call onClear when function is passed', async () => {
      const onClear = jest.fn();
      const select = render(<DataSourcePicker onClear={onClear} />);

      const clearButton = select.getByLabelText('Clear value');
      await userEvent.click(clearButton);
      expect(onClear).toHaveBeenCalled();
    });

    it('should not render clear button when no onClear function is passed', async () => {
      const select = render(<DataSourcePicker />);

      expect(() => {
        select.getByLabelText('Clear value');
      }).toThrowError();
    });

    it('should pass disabled prop', async () => {
      render(<DataSourcePicker disabled={true} />);

      const input = screen.getByLabelText('Select a data source');
      expect(input).toHaveProperty('disabled', true);
    });
  });
});
