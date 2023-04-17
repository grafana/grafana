import { render, screen } from '@testing-library/react';
import React from 'react';

import { Databases } from 'app/percona/shared/core';

import { ServiceIconWithText } from './ServiceIconWithText';

describe('ServiceIconWithText', () => {
  it('should show icon and text', () => {
    render(<ServiceIconWithText dbType={Databases.mysql} text="service 1" />);
    expect(screen.getByText('service 1')).toBeInTheDocument();
    expect(screen.getByTestId('service-icon')).toBeInTheDocument();
  });

  it('should show only text if icon not available', () => {
    render(<ServiceIconWithText dbType="external" text="service 1" />);
    expect(screen.getByText('service 1')).toBeInTheDocument();
    expect(screen.queryByTestId('service-icon')).not.toBeInTheDocument();
  });
});
