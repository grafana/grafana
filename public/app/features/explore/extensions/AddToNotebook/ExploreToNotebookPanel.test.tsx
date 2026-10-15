import { render } from 'test/test-utils';

import { type DataSourceApi, rangeUtil, type RawTimeRange } from '@grafana/data';
import { type DataSourceRef } from '@grafana/schema';
import { buildPanelElementFromExplore } from 'app/features/notebook/addPanel/buildPanelElementFromExplore';
import { type CapturedTimeRange } from 'app/features/notebook/addPanel/capturedTimeRange';
import { initialUserState } from 'app/features/profile/state/reducers';
import { type ExploreState } from 'app/types/explore';

import { createEmptyQueryResponse } from '../../state/utils';

import { ExploreToNotebookPanel } from './ExploreToNotebookPanel';

interface ModalBodyProps {
  buildPanel: () => Promise<unknown>;
  onDismiss: () => void;
  capturedTimeRange: CapturedTimeRange;
}

const mockModalBody = jest.fn();

// Stood in for rather than rendered: it has its own suite, and reaching it for real here would mean
// standing up the notebook list API to test a component that only forwards a few props to it.
jest.mock('app/features/notebook/addPanel/AddPanelToNotebookModalBody', () => ({
  AddPanelToNotebookModalBody: (props: ModalBodyProps) => {
    mockModalBody(props);
    return null;
  },
}));

jest.mock('app/features/notebook/addPanel/buildPanelElementFromExplore');

const DATASOURCE_REF: DataSourceRef = { type: 'prometheus', uid: 'prom' };

function setup({ withDatasource = true, rawRange = { from: 'now-6h', to: 'now' } as RawTimeRange } = {}) {
  const onClose = jest.fn();
  const queries = [{ refId: 'A' }];
  const queryResponse = createEmptyQueryResponse();
  const panelsState = { logs: { id: 'log-row-1' } };
  const range = rangeUtil.convertRawToRange(rawRange, 'utc');
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a whole pane, of which the component reads four fields
  const datasourceInstance = { getRef: () => DATASOURCE_REF } as DataSourceApi;

  render(<ExploreToNotebookPanel exploreId="left" onClose={onClose} />, {
    preloadedState: {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only this one pane is read
      explore: {
        panes: {
          left: {
            queries,
            queryResponse,
            panelsState,
            range,
            datasourceInstance: withDatasource ? datasourceInstance : undefined,
          },
        },
      } as unknown as ExploreState,
      user: { ...initialUserState, timeZone: 'utc' },
    },
  });

  const props: ModalBodyProps = mockModalBody.mock.calls[0][0];

  return { onClose, queries, queryResponse, panelsState, props };
}

describe('ExploreToNotebookPanel', () => {
  afterEach(() => jest.clearAllMocks());

  // The pane it was opened on, not whichever one Explore happens to consider current: a split view
  // would otherwise capture the wrong half.
  it('builds the notebook panel from the pane it was opened on', async () => {
    const { props, queries, queryResponse, panelsState } = setup();

    await props.buildPanel();

    expect(buildPanelElementFromExplore).toHaveBeenCalledWith({
      datasource: DATASOURCE_REF,
      queries,
      queryResponse,
      panelState: panelsState,
    });
  });

  // A pane can be sitting on a datasource that has not resolved yet, and the panel still has to be
  // capturable - the notebook just stores it without one.
  it('reports no datasource when the pane has no instance', async () => {
    const { props } = setup({ withDatasource: false });

    await props.buildPanel();

    expect(buildPanelElementFromExplore).toHaveBeenCalledWith(expect.objectContaining({ datasource: undefined }));
  });

  it('dismisses through the onClose it was given', () => {
    const { props, onClose } = setup();

    expect(props.onDismiss).toBe(onClose);
  });

  /**
   * The window the pane is showing, so the picker can offer to keep it. Zooming turns the range
   * absolute, and that is the case the lock defaults on for - see capturedTimeRange.
   */
  it('captures a zoomed window as the instants the pane was showing', () => {
    const { props } = setup({ rawRange: { from: '2026-10-05T08:00:00.000Z', to: '2026-10-05T09:30:00.000Z' } });

    expect(props.capturedTimeRange).toEqual({
      from: '2026-10-05T08:00:00.000Z',
      to: '2026-10-05T09:30:00.000Z',
      timeZone: 'utc',
    });
  });

  it('captures a relative window as the picker wrote it', () => {
    const { props } = setup();

    expect(props.capturedTimeRange).toEqual({ from: 'now-6h', to: 'now', timeZone: 'utc' });
  });
});
