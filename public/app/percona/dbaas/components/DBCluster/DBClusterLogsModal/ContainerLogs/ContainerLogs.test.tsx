import React from 'react';
import { ContainerLogs } from './ContainerLogs';
import { render } from '@testing-library/react';

describe('ContainerLogs::', () => {
  it('renders container name and logs', () => {
    const { container } = render(
      <ContainerLogs
        containerLogs={{
          name: 'Test',
          isOpen: true,
          logs: 'Test logs',
        }}
      />
    );

    expect(container.querySelector('div > div > div > div ')).toHaveTextContent('Test');
    expect(container.querySelector('pre')).toHaveTextContent('Test logs');
  });

  it("does't render logs when collapsed", () => {
    const { container } = render(
      <ContainerLogs
        containerLogs={{
          name: 'Test',
          isOpen: false,
          logs: 'Test logs',
        }}
      />
    );

    expect(container.querySelector('pre')).not.toBeInTheDocument();
  });
});
