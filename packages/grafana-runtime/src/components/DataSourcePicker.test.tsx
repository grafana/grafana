import { render, screen } from '@testing-library/react';

import { DataSourcePicker, type DataSourcePickerProps, setDataSourcePicker } from './DataSourcePicker';

describe('DataSourcePicker', () => {
  describe('setDataSourcePicker', () => {
    afterEach(() => {
      setDataSourcePicker(undefined);
    });

    it('should render the injected component with the provided props', () => {
      const InjectedPicker = jest.fn((props: DataSourcePickerProps) => <div>injected picker</div>);
      setDataSourcePicker(InjectedPicker);

      render(<DataSourcePicker onChange={jest.fn()} current="some-uid" placeholder="pick one" />);

      expect(screen.getByText('injected picker')).toBeInTheDocument();
      expect(InjectedPicker.mock.lastCall?.[0]).toMatchObject({ current: 'some-uid', placeholder: 'pick one' });
    });

    it('should render a placeholder message after the injected component is unset', () => {
      setDataSourcePicker(() => <div>injected picker</div>);
      setDataSourcePicker(undefined);

      render(<DataSourcePicker onChange={jest.fn()} current={null} />);

      expect(screen.queryByText('injected picker')).not.toBeInTheDocument();
      expect(
        screen.getByText('DataSourcePicker can only be used after Grafana instance has been started.')
      ).toBeInTheDocument();
    });
  });
});
