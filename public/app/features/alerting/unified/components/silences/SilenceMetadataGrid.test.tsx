import { render, screen } from 'test/test-utils';

import { SilenceMetadataGrid } from './SilenceMetadataGrid';

describe('SilenceMetadataGrid', () => {
  const defaultProps = {
    startsAt: '2024-01-15T10:00:00.000Z',
    endsAt: '2024-01-15T12:00:00.000Z',
    comment: 'Test silence comment',
    createdBy: 'admin',
  };

  it('should render comment', () => {
    render(<SilenceMetadataGrid {...defaultProps} />);
    expect(screen.getByText('Test silence comment')).toBeInTheDocument();
  });

  it('should render created by', () => {
    render(<SilenceMetadataGrid {...defaultProps} />);
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('should render schedule dates', () => {
    render(<SilenceMetadataGrid {...defaultProps} />);
    expect(screen.getByText(/2024-01-15/)).toBeInTheDocument();
  });

  it('should render duration', () => {
    render(<SilenceMetadataGrid {...defaultProps} />);
    expect(screen.getByText('2h')).toBeInTheDocument();
  });
});
