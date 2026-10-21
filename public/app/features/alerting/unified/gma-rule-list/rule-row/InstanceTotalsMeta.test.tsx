import { render, screen } from 'test/test-utils';

import { InstanceTotalsMeta } from './InstanceTotalsMeta';

describe('InstanceTotalsMeta', () => {
  it('lists every returned count in a fixed order, keeping a returned zero', () => {
    render(<InstanceTotalsMeta totals={{ error: 3, noData: 0, recovering: 1, pending: 2, firing: 0, healthy: 5 }} />);

    expect(screen.getByText('5 healthy, 0 firing, 2 pending, 1 recovering, 0 no data, 3 error')).toBeInTheDocument();
  });

  it('leaves out a total the API did not return instead of showing it as zero', () => {
    render(<InstanceTotalsMeta totals={{ firing: 2, error: 1 }} />);

    expect(screen.getByText('2 firing, 1 error')).toBeInTheDocument();
  });

  it('renders nothing when no total was returned', () => {
    const { container } = render(<InstanceTotalsMeta totals={{}} />);

    expect(container).toBeEmptyDOMElement();
  });
});
