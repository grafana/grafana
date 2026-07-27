import { render, screen } from 'test/test-utils';

import { ResourceStatusCard, resourceTone } from './ResourceStatusCard';

describe('resourceTone', () => {
  it('is success when everything is managed', () => {
    expect(resourceTone(4, 4)).toBe('success');
  });

  it('is warning when nothing is managed', () => {
    expect(resourceTone(0, 4)).toBe('warning');
  });

  it('is info when partially managed', () => {
    expect(resourceTone(2, 4)).toBe('info');
  });
});

describe('ResourceStatusCard', () => {
  it('renders the label, managed percentage and managed sub-label', () => {
    render(<ResourceStatusCard label="Dashboards" managed={2} total={4} />);

    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 managed')).toBeInTheDocument();
  });

  it('renders nothing when there are none of the resource', () => {
    const { container } = render(<ResourceStatusCard label="Folders" managed={0} total={0} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Folders')).not.toBeInTheDocument();
  });
});
