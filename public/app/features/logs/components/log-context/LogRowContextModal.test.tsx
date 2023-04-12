import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { createLogRow } from '../__mocks__/logRow';

import { LogRowContextModal } from './LogRowContextModal';

const getRowContext = jest.fn().mockResolvedValue({ data: { fields: [], rows: [] } });

const row = createLogRow({ uid: '1' });

const timeZone = 'UTC';

describe('LogRowContextModal', () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  afterEach(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    jest.clearAllMocks();
  });

  it('should not render modal when it is closed', () => {
    render(
      <LogRowContextModal row={row} open={false} onClose={() => {}} getRowContext={getRowContext} timeZone={timeZone} />
    );

    expect(screen.queryByText('Log context')).not.toBeInTheDocument();
  });

  it('should render modal when it is open', async () => {
    act(() => {
      render(
        <LogRowContextModal
          row={row}
          open={true}
          onClose={() => {}}
          getRowContext={getRowContext}
          timeZone={timeZone}
        />
      );
    });

    await waitFor(() => expect(screen.queryByText('Log context')).toBeInTheDocument());
  });

  it('should call getRowContext on open and change of row', () => {
    render(
      <LogRowContextModal row={row} open={false} onClose={() => {}} getRowContext={getRowContext} timeZone={timeZone} />
    );

    expect(getRowContext).not.toHaveBeenCalled();
  });
  it('should call getRowContext on open', async () => {
    act(() => {
      render(
        <LogRowContextModal
          row={row}
          open={true}
          onClose={() => {}}
          getRowContext={getRowContext}
          timeZone={timeZone}
        />
      );
    });
    await waitFor(() => expect(getRowContext).toHaveBeenCalledTimes(2));
  });

  it('should call getRowContext when limit changes', async () => {
    act(() => {
      render(
        <LogRowContextModal
          row={row}
          open={true}
          onClose={() => {}}
          getRowContext={getRowContext}
          timeZone={timeZone}
        />
      );
    });
    await waitFor(() => expect(getRowContext).toHaveBeenCalledTimes(2));

    const tenLinesButton = screen.getByRole('button', {
      name: /10 lines/i,
    });
    fireEvent.click(tenLinesButton);
    const twentyLinesButton = screen.getByRole('menuitemradio', {
      name: /20 lines/i,
    });
    act(() => {
      fireEvent.click(twentyLinesButton);
    });

    await waitFor(() => expect(getRowContext).toHaveBeenCalledTimes(4));
  });
});
