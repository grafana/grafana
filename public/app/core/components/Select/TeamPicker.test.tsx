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
  it('renders correctly', async () => {
    const props = {
      onSelected: () => {},
    };
    render(<TeamPicker {...props} />);
    expect(await screen.findByTestId('teamPicker')).toBeInTheDocument();
  });
});
