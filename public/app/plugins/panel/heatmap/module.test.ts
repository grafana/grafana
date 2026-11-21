import {
  createDataFrame,
  DataFrameType,
  FieldType,
  PanelOptionsEditorBuilder,
  standardEditorsRegistry,
} from '@grafana/data';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { plugin } from './module';
import { defaultOptions, type Options } from './panelcfg.gen';

standardEditorsRegistry.setInit(getAllOptionEditors);

/** A sparse heatmap-cells frame, the shape a native histogram arrives in. */
function createCellsFrame() {
  return createDataFrame({
    meta: { type: DataFrameType.HeatmapCells },
    fields: [
      { name: 'xMax', type: FieldType.time, values: [1000, 2000] },
      { name: 'yMin', type: FieldType.number, values: [10, 20] },
      { name: 'yMax', type: FieldType.number, values: [20, 30] },
      { name: 'count', type: FieldType.number, values: [5, 10] },
    ],
  });
}

/** The wide, one-field-per-bucket shape. */
function createRowsFrame() {
  return createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      { name: '10', type: FieldType.number, values: [5, 10] },
      { name: '20', type: FieldType.number, values: [15, 20] },
    ],
  });
}

function optionPaths(frames: Array<ReturnType<typeof createCellsFrame>>, options?: Partial<Options>) {
  const builder = new PanelOptionsEditorBuilder<Options>();
  plugin.getPanelOptionsSupplier()(builder, {
    data: frames,
    options: { ...defaultOptions, ...options } as Options,
  });
  return builder.getItems().map((item) => item.path);
}

describe('heatmap module', () => {
  // Without this the scale can only be changed by hand-editing the panel JSON, and a sparse
  // cells frame is stuck on the log scale that native histograms want.
  it('offers the Y bucket scale editor for heatmap-cells frames', () => {
    expect(optionPaths([createCellsFrame()])).toContain('rowsFrame.yBucketScale');
  });

  it('offers the Y bucket scale editor for rows frames', () => {
    expect(optionPaths([createRowsFrame()])).toContain('rowsFrame.yBucketScale');
  });

  // Calculating from data has its own bucket options, which set the scale instead.
  it('hides the Y bucket scale editor when calculating from data', () => {
    expect(optionPaths([createCellsFrame()], { calculate: true })).not.toContain('rowsFrame.yBucketScale');
  });
});
