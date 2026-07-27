import { render } from '@testing-library/react';
import { useRef } from 'react';

import { useScrollSelectedCardIntoView } from './useScrollSelectedCardIntoView';

interface HarnessProps {
  cardIds: string[];
  selectedId: string | null;
}

function Harness({ cardIds, selectedId }: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useScrollSelectedCardIntoView(containerRef, selectedId);
  return (
    <div ref={containerRef}>
      {cardIds.map((id) => (
        <div key={id} data-query-sidebar-card={id} data-testid={`card-${id}`} />
      ))}
    </div>
  );
}

describe('useScrollSelectedCardIntoView', () => {
  let scrollIntoViewSpy: jest.Mock;
  let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    // jsdom doesn't implement scrollIntoView, so patch the prototype rather than spy on it.
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    scrollIntoViewSpy = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("reveals the selected card minimally, so a selection driven from outside the sidebar can't leave it hidden", () => {
    const { getByTestId } = render(<Harness cardIds={['A', 'B', 'C']} selectedId="C" />);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(getByTestId('card-C'));
    // 'nearest' keeps it a no-op when the card is already visible (the direct-click case).
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('does nothing when no card is selected', () => {
    render(<Harness cardIds={['A', 'B']} selectedId={null} />);

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it('follows the selection as it moves between cards', () => {
    const { getByTestId, rerender } = render(<Harness cardIds={['A', 'B', 'C']} selectedId="A" />);
    scrollIntoViewSpy.mockClear();

    rerender(<Harness cardIds={['A', 'B', 'C']} selectedId="C" />);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(getByTestId('card-C'));
  });

  it('does nothing when the selected id matches no rendered card', () => {
    render(<Harness cardIds={['A', 'B']} selectedId="missing" />);

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });
});
