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

describe('ExplorePage', () => {
  it('updates split size when dragging', async () => {
    setupExplore();

    const splitButton = await screen.findByText(/split/i);
    await userEvent.click(splitButton);

    // Get resizer and right pane
    const resizer = screen.getByRole('presentation');
    const rightPane = resizer.nextElementSibling;

    // Assert width before dragging
    expect(rightPane).toHaveStyle({ width: '512px' });

    fireEvent.mouseDown(resizer, { button: 1 });
    fireEvent.mouseMove(resizer, { clientX: 100, button: 1 });
    fireEvent.mouseUp(resizer);

    // Verify that the split size is updated after dragging
    /* Currently, right pane will always be 200px,
    except when clientX is set to -200 and lower, 
    then it returns an unexpected value of -204800px.
    Also, widthCalc calculation always goes to scenario 3 in ExplorePage, see line 84 in ExplorePage.tsx
    */
    expect(rightPane).toHaveStyle({ width: '200px' });
  });
});
