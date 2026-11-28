import { act, renderHook, waitFor } from '@testing-library/react';

import { useAnchoredMenu } from './useAnchoredMenu';

it('keeps the last position and dismisses once when the anchor container is removed without scrolling', async () => {
  const container = document.createElement('div');
  const cell = document.createElement('div');
  container.appendChild(cell);
  document.body.appendChild(container);
  const initialRect = {
    x: 100,
    y: 200,
    left: 100,
    top: 200,
    right: 150,
    bottom: 220,
    width: 50,
    height: 20,
    toJSON: () => ({}),
  };
  const rect = jest.spyOn(cell, 'getBoundingClientRect').mockReturnValue(initialRect);
  const anchor = { clientX: 125, clientY: 210, contextElement: cell };
  const onClose = jest.fn();
  const { result, unmount } = renderHook(() => useAnchoredMenu(anchor, onClose));

  rect.mockReturnValue({ ...initialRect, top: 180 });
  expect(result.current.reference?.getBoundingClientRect()).toMatchObject({ x: 125, y: 190 });
  act(() => {
    container.remove();
    rect.mockReturnValue({ ...initialRect, left: 0, top: 0 });
    expect(result.current.reference?.getBoundingClientRect()).toMatchObject({ x: 125, y: 190 });
  });
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  act(() => window.dispatchEvent(new Event('scroll')));
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();
});
