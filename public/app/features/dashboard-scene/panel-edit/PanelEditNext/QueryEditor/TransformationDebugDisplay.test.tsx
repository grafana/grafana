import { screen } from '@testing-library/react';

import { getDefaultTimeRange, LoadingState, toDataFrame, type TransformerRegistryItem } from '@grafana/data';
import { DataTopic } from '@grafana/schema';

import { TransformationDebugDisplay } from './TransformationDebugDisplay';
import { useTransformationDebugData } from './hooks/useTransformationDebugData';
import { renderWithQueryEditorProvider } from './testUtils';
import { type Transformation } from './types';

jest.mock('./hooks/useTransformationDebugData');

const mockedUseTransformationDebugData = jest.mocked(useTransformationDebugData);

const registryItem: TransformerRegistryItem = {
  id: 'test-transform',
  name: 'Test Transform',
  transformation: () => Promise.resolve({ id: 'test-transform', name: 'Test Transform', operator: jest.fn() }),
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

const transformation: Transformation = {
  transformId: 'test-transform-0',
  transformConfig: { id: 'test-transform', options: {} },
  registryItem,
};

describe('TransformationDebugDisplay', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });

  it('copies circular frame data safely and labels both copy actions', async () => {
    const frame = toDataFrame({ fields: [{ name: 'value', values: [1] }] });
    const field = frame.fields[0];
    field.state = {
      scopedVars: {
        __dataContext: { value: { data: [frame], frame, field } },
      },
    };
    mockedUseTransformationDebugData.mockReturnValue({ input: [frame], output: [] });

    const { user } = renderWithQueryEditorProvider(<TransformationDebugDisplay />, {
      transformations: [transformation],
      selectedTransformation: transformation,
      uiStateOverrides: {
        transformToggles: { showDebug: true, toggleDebug: jest.fn(), showHelp: false, toggleHelp: jest.fn() },
      },
    });

    const copyInput = screen.getByRole('button', { name: 'Copy input data to clipboard' });
    expect(screen.getByRole('button', { name: 'Copy output data to clipboard' })).toBeInTheDocument();

    await user.click(copyInput);

    const copiedFrames = JSON.parse(await navigator.clipboard.readText());
    expect(copiedFrames[0].fields[0].state.scopedVars.__dataContext).toBe('Filtered out in JSON serialization');
  });

  describe('frames the debug view replays', () => {
    const seriesFrame = toDataFrame({ name: 'series-frame', fields: [{ name: 'value', values: [1] }] });
    const annotationFrame = toDataFrame({ name: 'annotation-frame', fields: [{ name: 'text', values: ['deploy'] }] });
    const queryFrames = { series: [seriesFrame], annotations: [annotationFrame] };

    it.each<{ desc: string; topic: DataTopic | undefined; runsOver: 'series' | 'annotations' }>([
      { desc: 'no topic', topic: undefined, runsOver: 'series' },
      { desc: 'the series topic', topic: DataTopic.Series, runsOver: 'series' },
      { desc: 'the annotations topic', topic: DataTopic.Annotations, runsOver: 'annotations' },
    ])('replays a transformation with $desc over the $runsOver frames', ({ topic, runsOver }) => {
      mockedUseTransformationDebugData.mockReturnValue({ input: [], output: [] });
      const selected: Transformation = {
        ...transformation,
        transformConfig: { ...transformation.transformConfig, topic },
      };

      renderWithQueryEditorProvider(<TransformationDebugDisplay />, {
        transformations: [selected],
        selectedTransformation: selected,
        qrState: {
          data: { state: LoadingState.Done, ...queryFrames, timeRange: getDefaultTimeRange() },
        },
        uiStateOverrides: {
          transformToggles: { showDebug: true, toggleDebug: jest.fn(), showHelp: false, toggleHelp: jest.fn() },
        },
      });

      expect(mockedUseTransformationDebugData).toHaveBeenLastCalledWith(
        expect.objectContaining({ selectedTransformation: selected, data: queryFrames[runsOver] })
      );
    });
  });
});
