import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { LeftSideBar } from './LeftSideBar';

describe('LeftSideBar', () => {
  it('renders sidebar title when pdcInjected is true', () => {
    render(<LeftSideBar pdcInjected={true} />);
    expect(screen.getByTestId('Private data source connect-sidebar')).toBeInTheDocument();
  });

  it('does not render sidebar title when pdcInjected is false', () => {
    render(<LeftSideBar pdcInjected={false} />);
    expect(screen.queryByTestId('Private data source connect-sidebar')).not.toBeInTheDocument();
  });
});
