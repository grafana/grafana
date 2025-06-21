import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';

import { ConfigEditor } from './ConfigEditor';
import { createTestProps } from './helpers';

jest.mock('./LeftSideBar', () => ({
  LeftSideBar: () => <div data-testid="left-sidebar" />,
}));

jest.mock('./UrlAndAuthenticationSection', () => ({
  UrlAndAuthenticationSection: () => <div data-testid="url-auth-section" />,
}));

jest.mock('./DatabaseConnectionSection', () => ({
  DatabaseConnectionSection: () => <div data-testid="db-connection-section" />,
}));

describe('ConfigEditor', () => {
  const defaultProps = createTestProps({
    options: {
      jsonData: {},
      secureJsonData: {},
      secureJsonFields: {},
    },
    mocks: {
      onOptionsChange: jest.fn(),
    },
  });

  it('renders the LeftSideBar, UrlAndAuthenticationSection, and DatabaseConnectionSection', () => {
    render(<ConfigEditor {...defaultProps} />);

    expect(screen.getByTestId('left-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('url-auth-section')).toBeInTheDocument();
    expect(screen.getByTestId('db-connection-section')).toBeInTheDocument();
  });

  it('shows the informational alert', () => {
    render(<ConfigEditor {...defaultProps} />);
    expect(screen.getByText(/You are viewing a new design/i)).toBeInTheDocument();
  });
});
