import { render, screen } from 'test/test-utils';

import { FolderProgressCard } from './FolderProgressCard';

describe('FolderProgressCard', () => {
  it('renders the managed/total fraction and percentage', () => {
    render(<FolderProgressCard managed={6} total={8} />);

    expect(screen.getByText('Folders managed')).toBeInTheDocument();
    expect(screen.getByText('6 / 8')).toBeInTheDocument();
    expect(screen.getByText('75% complete')).toBeInTheDocument();
  });

  it('shows 0% when there are no folders', () => {
    render(<FolderProgressCard managed={0} total={0} />);

    expect(screen.getByText('0 / 0')).toBeInTheDocument();
    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('rounds the percentage', () => {
    render(<FolderProgressCard managed={1} total={3} />);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('33% complete')).toBeInTheDocument();
  });
});
