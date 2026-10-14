import { render } from '@testing-library/react';
import { useState } from 'react';

import { useFloatingDrag } from './useFloatingDrag';

// In its own file: the stored position is dropped once per page load, so this must be the first mount.
const LEGACY_KEY = 'grafana.navigation.extensionSidebarFloatingOffset';

function Floating() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useFloatingDrag(element);
  return <div ref={setElement} />;
}

it('drops a position an earlier build remembered, without reading it', () => {
  window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ x: -100, y: -100 }));
  const getItem = jest.spyOn(Storage.prototype, 'getItem');

  render(<Floating />);

  expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  expect(getItem.mock.calls.filter(([key]) => key === LEGACY_KEY)).toHaveLength(1); // the assertion above
});
