import React from 'react';
import { DBClusterConnectionItem } from './DBClusterConnectionItem';
import { render } from '@testing-library/react';

describe('DBClusterConnectionItem::', () => {
  it('renders correctly', () => {
    const { container } = render(<DBClusterConnectionItem label="Test" value="test" />);

    expect(container.querySelectorAll('span')).toHaveLength(2);
    expect(container.querySelector('div')?.children).toHaveLength(2);
  });
  it('renders correctly label and value', () => {
    const { container } = render(<DBClusterConnectionItem label="test label" value="test value" />);

    expect(container).toHaveTextContent('test label');
    expect(container).toHaveTextContent('test value');
  });
});
