import { render, screen } from 'test/test-utils';

import { FolderPath } from './FolderPath';

describe('FolderPath', () => {
  it('renders segments root first with chevron separators, never a slash', () => {
    const { container } = render(<FolderPath segments={['Platform', 'Infra', 'Kubernetes']} />);

    expect(container).toHaveTextContent('PlatformInfraKubernetes');
    expect(container).not.toHaveTextContent('/');
    expect(screen.getByText('Platform').compareDocumentPosition(screen.getByText('Infra'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByTestId('icon-folder')).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-angle-right')).toHaveLength(2);
  });

  it('has no separator for a single segment', () => {
    render(<FolderPath segments={['Platform']} />);
    expect(screen.getByTestId('icon-folder')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-angle-right')).not.toBeInTheDocument();
  });
});
