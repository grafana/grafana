import { render, waitFor } from '@testing-library/react';

import {
  type DataFrame,
  type DataTransformerInfo,
  FieldType,
  LoadingState,
  type PanelData,
  type TransformerRegistryItem,
  dateTime,
  standardTransformersRegistry,
} from '@grafana/data';
import { filterFieldsByNameTransformer } from '@grafana/data/internal';

import { TransformationEditorPanel } from './TransformationEditorRenderer';
import { type Transformation } from './types';

// The real hook runs here — this file exists to check what an editor is actually handed, which is
// the thing the hook-level tests can only assert indirectly. Where a transformation precedes the
// selected one, the real `transformDataFrame` runs too; with nothing preceding it the replay
// short-circuits and never subscribes, which is why only one case below registers a transformer.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => v }),
}));

/** The frames the editor received, in order, so an assertion can name them. */
let receivedInput: DataFrame[] = [];

jest.mock('./TransformationEditor', () => ({
  TransformationEditor: ({ inputData }: { inputData: DataFrame[] }) => {
    receivedInput = inputData;
    return <div data-testid="transformation-editor" />;
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

/** A field filter, as a transformation that can sit ahead of the one under test. */
function makeFieldFilter(): Transformation {
  return {
    transformId: 'filterFieldsByName',
    transformConfig: { id: 'filterFieldsByName', options: { include: { names: ['Min'] } } },
    registryItem: undefined,
  };
}

/** One frame per query, which is the shape two `random_walk_table` targets return. */
function makePanelData(): PanelData {
  const fields = [
    { name: 'Min', type: FieldType.number, config: {}, values: [1] },
    { name: 'Max', type: FieldType.number, config: {}, values: [2] },
  ];

  return {
    state: LoadingState.Done,
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-6h', to: 'now' } },
    series: [
      { refId: 'A', name: 'A-series', fields, length: 1 },
      { refId: 'B', name: 'B-series', fields, length: 1 },
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

  it("narrows to the frames the transformation's own filter admits", () => {
    // The shape from the bug report: two queries returning one frame each, a single Organize
    // transformation filtered to refId A. The panel renders fine because `transformDataFrame`
    // applies that filter, but the editor used to be handed both frames and so reported
    // "Organize fields only works with a single frame" on a panel that was configured correctly.
    // The filter is stored in the regex form a dashboard actually writes, not a bare refId.
    render(panel(makeOrganize('/^(?:A)$/')));

    expect(receivedInput.map((frame) => frame.refId)).toEqual(['A']);
  });

  it('hands over every frame when the transformation has no filter', () => {
    // The other half of the same behaviour — narrowing has to be the filter's doing, not something
    // that quietly drops frames from an unfiltered transformation.
    render(panel(makeOrganize()));

    expect(receivedInput.map((frame) => frame.refId)).toEqual(['A', 'B']);
  });

  describe('with a transformation ahead of it in the pipeline', () => {
    // The preceding stage is replayed through the real `transformDataFrame`, so this is the case
    // that checks the filter narrows what that stage produced rather than the raw query data.
    beforeAll(() => {
      standardTransformersRegistry.setInit(() => [
        {
          id: filterFieldsByNameTransformer.id,
          name: filterFieldsByNameTransformer.name,
          description: filterFieldsByNameTransformer.description,
          transformation: () => Promise.resolve(filterFieldsByNameTransformer),
          editor: () => null,
          imageDark: '',
          imageLight: '',
        },
      ]);
    });

    it('narrows the preceding stage output, not the raw query data', async () => {
      const fieldFilter = makeFieldFilter();
      const organize = makeOrganize('/^(?:A)$/');

      render(panel(organize, [fieldFilter, organize]));

      // Replaying the preceding stage resolves a render later, so this one genuinely waits — and it
      // waits on the field names rather than the refIds, because the refIds already read `['A']`
      // while the replay is in flight and would let the assertion pass against the stand-in frames.
      // Only `Min` survives, which is the preceding transformation's doing — proof the editor is
      // reading that stage's output and not the two-field frames the query produced.
      await waitFor(() => expect(receivedInput[0].fields.map((field) => field.name)).toEqual(['Min']));

      expect(receivedInput.map((frame) => frame.refId)).toEqual(['A']);
    });
  });
});
