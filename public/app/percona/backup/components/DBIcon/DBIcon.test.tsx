import React from 'react';
import { DBIcon } from './DBIcon';
import { DBIconType } from './DBIcon.types';
import { Tooltip } from '@grafana/ui';
import { render, screen } from '@testing-library/react';
import { svg } from '../../../../../test/mocks/svg';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Tooltip: jest.fn(() => <div data-testid="tooltip" />),
}));

describe('DBIcon', () => {
  it('should not display unknown icons', async () => {
    render(<DBIcon type={'unknown' as DBIconType} />);
    expect(screen.queryAllByRole(svg)).toHaveLength(0);
  });

  it('should display known icons', () => {
    const { container } = render(<DBIcon type="edit" />);
    const svg = container.querySelectorAll('svg');
    expect(svg).toHaveLength(1);
  });

  it('should have 22 x 22 icons by default', () => {
    const { container } = render(<DBIcon type="edit" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '22');
    expect(svg).toHaveAttribute('height', '22');
  });

  it('should change icon size', () => {
    const { container } = render(<DBIcon size={30} type="edit" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '30');
    expect(svg).toHaveAttribute('height', '30');
  });

  it('should now show tooltip if no text is passed', () => {
    render(<DBIcon size={30} type="edit" />);
    expect(Tooltip).toHaveBeenCalledTimes(0);
  });

  it('should show tooltip if text is passed', async () => {
    render(<DBIcon size={30} type="edit" tooltipText="helper text" />);
    expect(Tooltip).toHaveBeenCalledTimes(1);
  });
});
