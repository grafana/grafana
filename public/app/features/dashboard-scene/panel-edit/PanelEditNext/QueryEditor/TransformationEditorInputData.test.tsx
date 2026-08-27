import { render, screen, waitFor } from '@testing-library/react';

import {
  type DataFrame,
  type DataTransformerInfo,
  FieldType,
  LoadingState,
  type PanelData,
  type TransformerRegistryItem,
  dateTime,
} from '@grafana/data';

import { TransformationEditorPanel } from './TransformationEditorRenderer';
import { type Transformation } from './types';

// The real hook and the real `transformDataFrame` run here — this file exists to check what an
// editor is actually handed, which is the thing the hook-level tests can only assert indirectly.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => v }),
}));

/** The frames the editor received, in order, so an assertion can name them. */
let receivedInput: DataFrame[] = [];

jest.mock('./TransformationEditor', () => ({
  TransformationEditor: ({ inputData }: { inputData: DataFrame[] }) => {
    receivedInput = inputData;
    return <div data-testid="transformation-editor">{inputData.map((frame) => frame.refId).join(',')}</div>;
  },
}));

jest.mock('./TransformationFilterDisplay', () => ({
  TransformationFilterEditor: () => <div data-testid="transformation-filter-display" />,
}));

const mockTransformation: DataTransformerInfo = {
  id: 'organize',
  name: 'Organize fields by name',
  operator: jest.fn(),
};

const mockRegistryItem: TransformerRegistryItem = {
  id: 'organize',
  name: 'Organize fields by name',
  transformation: () => Promise.resolve(mockTransformation),
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

function makeOrganize(filterOptions?: string): Transformation {
  return {
    transformId: 'organize',
    transformConfig: {
      id: 'organize',
      options: { excludeByName: { Min: true }, includeByName: {}, indexByName: {}, renameByName: {} },
      ...(filterOptions != null && { filter: { id: 'byRefId', options: filterOptions } }),
    },
    registryItem: mockRegistryItem,
  };
}

/** One frame per query, which is the shape two `random_walk_table` targets return. */
function makePanelData(): PanelData {
  const field = { name: 'Min', type: FieldType.number, config: {}, values: [1] };

  return {
    state: LoadingState.Done,
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-6h', to: 'now' } },
    series: [
      { refId: 'A', name: 'A-series', fields: [field], length: 1 },
      { refId: 'B', name: 'B-series', fields: [field], length: 1 },
    ],
  };
}

function panel(transformation: Transformation, transformations = [transformation]) {
  return (
    <TransformationEditorPanel
      transformation={transformation}
      transformations={transformations}
      data={makePanelData()}
      updateTransformation={jest.fn()}
    />
  );
}

describe('the input an editor is handed', () => {
  beforeEach(() => {
    receivedInput = [];
  });

  it('narrows to the frames the transformation own filter admits', async () => {
    // The shape from the bug report: two queries returning one frame each, a single Organize
    // transformation filtered to refId A. The panel renders fine because `transformDataFrame`
    // applies that filter, but the editor used to be handed both frames and so reported
    // "Organize fields only works with a single frame" on a panel that was configured correctly.
    // The filter is stored in the regex form a dashboard actually writes, not a bare refId.
    render(panel(makeOrganize('/^(?:A)$/')));

    await waitFor(() => expect(screen.getByTestId('transformation-editor')).toHaveTextContent('A'));

    expect(receivedInput.map((frame) => frame.refId)).toEqual(['A']);
    // The assertion that matters for the reported symptom: one frame, so the editor has no reason
    // to claim it cannot work with what it was given.
    expect(receivedInput).toHaveLength(1);
  });

  it('hands over every frame when the transformation has no filter', async () => {
    // The other half of the same behaviour — narrowing has to be the filter's doing, not something
    // that quietly drops frames from an unfiltered transformation.
    render(panel(makeOrganize()));

    await waitFor(() => expect(screen.getByTestId('transformation-editor')).toHaveTextContent('A,B'));

    expect(receivedInput.map((frame) => frame.refId)).toEqual(['A', 'B']);
  });
});
