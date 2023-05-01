import { render } from '@testing-library/react';
import React from 'react';

import { EditDataSourceSubtitle } from './EditDataSourceSubtitle';
const setup = (propOverrides?: object) => {
  const props = {
    dataSourcePluginName: 'My Datasource',
    isDefault: false,
    alertingSupported: false,
    onDefaultChange: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return render(<EditDataSourceSubtitle {...props} />);
};

describe('<EditDataSourceSubtitle>', () => {
  it('should render component', () => {
    setup();
  });

  it('should render default datasource switch=true', () => {
    setup({ isDefault: true });
  });

  it('should render alerting badge', () => {
    setup({ alertingSupported: true });
  });
});
