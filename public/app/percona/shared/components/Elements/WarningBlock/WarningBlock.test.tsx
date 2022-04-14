import React from 'react';
import { Icon } from '@grafana/ui';
import { WarningBlock } from './WarningBlock';
import { render, screen } from '@testing-library/react';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Icon: jest.fn(() => <div />),
}));

describe('WarningBlock', () => {
  it('should have warning icon and message', () => {
    render(<WarningBlock message="message" />);
    expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'info-circle' }), expect.anything());
    expect(screen.getByTestId('warning-block')).toHaveTextContent('message');
  });
});
