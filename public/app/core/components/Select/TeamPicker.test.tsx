import React from 'react';
import { render, screen } from '@testing-library/react';
import { TeamPicker } from './TeamPicker';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => {
    return {
      get: () => {
        return Promise.resolve([]);
      },
    };
  },
}));

describe('TeamPicker', () => {
  it('renders correctly', () => {
    const props = {
      onSelected: () => {},
    };
    render(<TeamPicker {...props} />);
    expect(screen.getByTestId('teamPicker')).toBeInTheDocument();
  });
});
