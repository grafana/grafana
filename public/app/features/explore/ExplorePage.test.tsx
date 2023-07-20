import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { setupExplore } from './spec/helper/setup';

const fetch = jest.fn().mockResolvedValue({ correlations: [] });
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ fetch }),
}));

jest.mock('rxjs', () => ({
  ...jest.requireActual('rxjs'),
  lastValueFrom: () =>
    new Promise((resolve, reject) => {
      resolve({ data: { correlations: [] } });
    }),
}));

function mockBoundingRectWidth(element: Element, width: number) {
  element.getBoundingClientRect = (): DOMRect => {
    return {
      x: 0,
      y: 0,
      toJSON: () => '',
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width,
    };
  };
}

describe('ExplorePage', () => {
  it('updates split size when dragging', async () => {
    setupExplore();

    // Click split button
    const splitButton = await screen.findByText(/split/i);
    await userEvent.click(splitButton);

    // Get resizer and panes
    const resizer = screen.getByRole('presentation');
    const splitPaneContainer = resizer.parentElement!;
    const leftPane = resizer.previousElementSibling!;
    const rightPane = resizer.nextElementSibling!;

    mockBoundingRectWidth(splitPaneContainer, 1024);
    mockBoundingRectWidth(leftPane, 512);
    mockBoundingRectWidth(rightPane, 512);

    // Assert width before dragging
    expect(rightPane).toHaveStyle({ width: '512px' });

    // Drag resizer
    fireEvent.mouseDown(resizer, { button: 1 });
    fireEvent.mouseMove(resizer, { clientX: 100, button: 1 });
    fireEvent.mouseUp(resizer);

    // Verify that the split size is updated after dragging
    expect(rightPane).toHaveStyle({ width: '412px' });
  });
});
