import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import {
  type DataFrame,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';
import { SceneDataNode, VizPanel } from '@grafana/scenes';

import { ViewPanelColumnOptions } from './ViewPanelColumnOptions';
import { type AdhocTransformsState, ViewPanelSidePane } from './ViewPanelSidePane';

describe('ViewPanelColumnOptions', () => {
  it('lists each unique field name once across frames', () => {
    setup({ frames: [buildFrame(['time', 'cpu']), buildFrame(['time', 'cpu'])] });

    expect(getColumnLabels()).toEqual(['Hide time', 'Hide cpu']);
  });

  it('updates the listed fields when the panel data changes', async () => {
    const { dataNode } = setup({ frames: [buildFrame(['time', 'cpu'])] });

    act(() => dataNode.setState({ data: buildPanelData([buildFrame(['time', 'disk'])]) }));

    await waitFor(() => expect(getColumnLabels()).toEqual(['Hide time', 'Hide disk']));
  });

  it('excludes the field when hiding it', async () => {
    const { pane, user } = setup({ frames: [buildFrame(['time', 'cpu'])] });

    await user.click(screen.getByRole('button', { name: 'Hide cpu' }));

    expect(pane.state.adhocTransforms?.organize.excludeByName).toEqual({ cpu: true });
    expect(getColumnLabels()).toEqual(['Hide time', 'Show cpu']);
  });

  it('stops excluding the field when showing it again', async () => {
    const { pane, user } = setup({
      frames: [buildFrame(['time', 'cpu'])],
      adhocTransforms: { organize: { excludeByName: { cpu: true }, indexByName: {}, renameByName: {} } },
    });

    await user.click(screen.getByRole('button', { name: 'Show cpu' }));

    expect(pane.state.adhocTransforms?.organize.excludeByName).toEqual({ cpu: false });
    expect(getColumnLabels()).toEqual(['Hide time', 'Hide cpu']);
  });

  it('lists the fields in the order given by indexByName', () => {
    setup({
      frames: [buildFrame(['time', 'cpu', 'mem'])],
      adhocTransforms: {
        organize: { excludeByName: {}, indexByName: { mem: 0, cpu: 1, time: 2 }, renameByName: {} },
      },
    });

    expect(getColumnLabels()).toEqual(['Hide mem', 'Hide cpu', 'Hide time']);
  });

  it('stores the new order in indexByName when a field is dragged down', async () => {
    const { pane, container, findByText } = setup({ frames: [buildFrame(['time', 'cpu', 'mem'])] });

    await dragItem(container, findByText, 0, 'down');

    expect(pane.state.adhocTransforms?.organize.indexByName).toEqual({ cpu: 0, time: 1, mem: 2 });
    expect(getColumnLabels()).toEqual(['Hide cpu', 'Hide time', 'Hide mem']);
  });
});

interface SetupOptions {
  frames: DataFrame[];
  adhocTransforms?: AdhocTransformsState;
}

function setup({ frames, adhocTransforms }: SetupOptions) {
  const dataNode = new SceneDataNode({ data: buildPanelData(frames) });
  const panel = new VizPanel({ pluginId: 'table', $data: dataNode });
  const pane = new ViewPanelSidePane({ panelRef: panel.getRef(), adhocTransforms });

  const renderResult = render(
    <TestProvider>
      <ViewPanelColumnOptions panel={panel} pane={pane} />
    </TestProvider>
  );

  return { pane, dataNode, user: userEvent.setup(), ...renderResult };
}

/**
 * The hide/show buttons are labelled by field name, so their labels give both the
 * listed fields and the order they are rendered in.
 */
function getColumnLabels() {
  return screen.getAllByRole('button', { name: /^(Hide|Show) / }).map((button) => button.getAttribute('aria-label'));
}

async function dragItem(
  container: HTMLElement,
  findByText: (text: RegExp) => Promise<HTMLElement>,
  itemIndex: number,
  direction: 'up' | 'down'
) {
  const handle = container.querySelectorAll<HTMLElement>('[data-rfd-drag-handle-draggable-id]')[itemIndex];
  handle.focus();

  // press space to start dragging
  fireEvent.keyDown(handle, { keyCode: 32 });
  await findByText(/you have lifted an item/i); // @hello-pangea/dnd announces each phase via aria-live; awaiting it ensures the library has processed the event

  fireEvent.keyDown(handle, { keyCode: direction === 'down' ? 40 : 38 });
  await findByText(/you have moved the item/i);

  // press space to drop
  fireEvent.keyDown(handle, { keyCode: 32 });
  await findByText(/you have dropped the item/i);
}

function buildFrame(fieldNames: string[]): DataFrame {
  return toDataFrame({
    fields: fieldNames.map((name) => ({
      name,
      values: [1, 2, 3],
      type: name === 'time' ? FieldType.time : FieldType.number,
    })),
  });
}

function buildPanelData(series: DataFrame[]): PanelData {
  return { series, state: LoadingState.Done, timeRange: getDefaultTimeRange() };
}
