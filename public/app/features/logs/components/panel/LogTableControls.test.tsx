import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogsSortOrder } from '@grafana/schema/dist/esm/common/common.gen';

import { LogTableControls } from './LogTableControls';

describe('LogTableControls', () => {
  it.each([LogsSortOrder.Descending, LogsSortOrder.Ascending])('should render descending', (sortOrder) => {
    render(
      <LogTableControls
        logOptionsStorageKey={''}
        controlsExpanded={false}
        setControlsExpanded={jest.fn()}
        sortOrder={sortOrder}
        setSortOrder={jest.fn()}
      />
    );
    expect(screen.getByLabelText('Expand')).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Sorted by ${sortOrder === LogsSortOrder.Ascending ? 'oldest' : 'newest'}`, {
        exact: false,
      })
    ).toBeInTheDocument();
  });

  it.each([true, false])('should call setControlsExpanded', async (expanded) => {
    const setControlsExpanded = jest.fn();
    const expandedText = expanded ? 'Collapse' : 'Expand';

    render(
      <LogTableControls
        logOptionsStorageKey={''}
        controlsExpanded={expanded}
        setControlsExpanded={setControlsExpanded}
        sortOrder={LogsSortOrder.Ascending}
        setSortOrder={jest.fn()}
      />
    );
    expect(screen.getByLabelText(expandedText)).toBeInTheDocument();
    expect(setControlsExpanded).toBeCalledTimes(0);
    await userEvent.click(screen.getByLabelText(expandedText));
    expect(setControlsExpanded).toBeCalledTimes(1);
    expect(setControlsExpanded).toBeCalledWith(!expanded);
  });

  it.each([LogsSortOrder.Ascending, LogsSortOrder.Descending])(
    'should call setSortOrder',
    async (sortOrder: LogsSortOrder) => {
      const setSortOrder = jest.fn();
      const sortOrderText = `Sorted by ${sortOrder === LogsSortOrder.Ascending ? 'oldest' : 'newest'}`;
      render(
        <LogTableControls
          logOptionsStorageKey={''}
          controlsExpanded={false}
          setControlsExpanded={jest.fn()}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
        />
      );

      expect(screen.getByLabelText(/sorted by/i)).toBeInTheDocument();
      expect(setSortOrder).toBeCalledTimes(0);
      await userEvent.click(screen.getByLabelText(sortOrderText, { exact: false }));
      expect(setSortOrder).toBeCalledTimes(1);
      expect(setSortOrder).toBeCalledWith(
        sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending
      );
    }
  );
});
