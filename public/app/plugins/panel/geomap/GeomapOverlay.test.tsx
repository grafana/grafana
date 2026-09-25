import { render, screen } from '@testing-library/react';

import { GeomapOverlay } from './GeomapOverlay';

describe('GeomapOverlay', () => {
  it('should render an empty overlay container when all slots are empty', () => {
    const { container } = render(<GeomapOverlay />);
    const overlay = container.firstChild as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay!.children).toHaveLength(0);
  });

  it('should render only topRight1 when only topRight1 is provided', () => {
    render(<GeomapOverlay topRight1={[<div key="a" data-testid="tr1-child" />]} />);
    expect(screen.getByTestId('tr1-child')).toBeInTheDocument();
    expect(screen.queryByTestId('tr2-child')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bl-child')).not.toBeInTheDocument();
  });

  it('should render all three slots when each receives a node', () => {
    render(
      <GeomapOverlay
        topRight1={[<div key="a" data-testid="tr1-child" />]}
        topRight2={[<div key="b" data-testid="tr2-child" />]}
        bottomLeft={[<div key="c" data-testid="bl-child" />]}
      />
    );
    expect(screen.getByTestId('tr1-child')).toBeInTheDocument();
    expect(screen.getByTestId('tr2-child')).toBeInTheDocument();
    expect(screen.getByTestId('bl-child')).toBeInTheDocument();
  });

  it('should apply blStyle to the bottomLeft slot', () => {
    render(<GeomapOverlay bottomLeft={[<div key="c" data-testid="bl-child" />]} blStyle={{ bottom: '35px' }} />);
    const slot = screen.getByTestId('bl-child').parentElement!;
    expect(slot).toHaveStyle({ bottom: '35px' });
  });

  it('should shift topRight2 down to 80px when topRight1 is also present', () => {
    render(
      <GeomapOverlay
        topRight1={[<div key="a" data-testid="tr1-child" />]}
        topRight2={[<div key="b" data-testid="tr2-child" />]}
      />
    );
    const tr2Slot = screen.getByTestId('tr2-child').parentElement!;
    expect(tr2Slot).toHaveStyle({ top: '80px' });
  });

  it('should keep topRight2 at the default top offset when topRight1 is absent', () => {
    render(<GeomapOverlay topRight2={[<div key="b" data-testid="tr2-child" />]} />);
    const tr2Slot = screen.getByTestId('tr2-child').parentElement!;
    expect(tr2Slot).toHaveStyle({ top: '8px' });
  });
});
