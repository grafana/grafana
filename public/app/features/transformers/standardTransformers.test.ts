import { DataTransformerID } from '@grafana/data';

jest.mock('@grafana/runtime', () => ({
  config: {
    featureToggles: {
      smoothingTransformation: false,
    },
  },
}));

import { isHeatmapApplicable } from './calculateHeatmap/applicability';
import { isSmoothingApplicable } from './smoothing/applicability';
import { getStandardTransformers } from './standardTransformers';

// these transformers are not dispayed in the UI and exist to support other transformers
const HIDDEN_TRANSFORMS: DataTransformerID[] = [
  DataTransformerID.ensureColumns,
  DataTransformerID.noop,
  DataTransformerID.order,
  DataTransformerID.rename,
  DataTransformerID.filterFields,
  DataTransformerID.filterFrames,
  DataTransformerID.convertFrameType,
  DataTransformerID.append,
];

// these transformers are not included in the standard picker for other reasons
const SPECIAL_CASES = [
  DataTransformerID.seriesToColumns, // deprecated and aliased
  DataTransformerID.smoothing, // feature gated currently
];

describe('getStandardTransformers', () => {
  describe('hiddenTransformer items', () => {
    it('have excludeFromPicker set to true', () => {
      const hidden = getStandardTransformers().filter((i) => i.excludeFromPicker);
      expect(hidden.length).toBeGreaterThan(0);
      for (const item of hidden) {
        expect(item.excludeFromPicker).toBe(true);
      }
    });

    it('have empty image and description fields', () => {
      const hidden = getStandardTransformers().filter((i) => i.excludeFromPicker);
      for (const item of hidden) {
        expect(item.imageDark).toBe('');
        expect(item.imageLight).toBe('');
        expect(item.description).toBe('');
      }
    });

    it('includes the expected hidden IDs', () => {
      expect(
        new Set(
          getStandardTransformers()
            .filter((i) => i.excludeFromPicker)
            .map((i) => i.id)
        )
      ).toEqual(new Set(HIDDEN_TRANSFORMS));
    });
  });

  describe('visible transformer IDs', () => {
    it('includes all standard picker transformers', () => {
      const ids = new Set(
        getStandardTransformers()
          .filter((i) => !i.excludeFromPicker)
          .map((i) => i.id)
      );

      const expectedVisible = Object.values(DataTransformerID).filter(
        (id) => !HIDDEN_TRANSFORMS.includes(id) && !SPECIAL_CASES.includes(id)
      );

      expect(ids.size).toEqual(expectedVisible.length);
      for (const id of expectedVisible) {
        expect(ids).toContain(id);
      }
    });
  });

  describe('smoothing feature toggle', () => {
    it('excludes smoothing when smoothingTransformation toggle is off', () => {
      const items = getStandardTransformers();
      expect(items.find((i) => i.id === DataTransformerID.smoothing)).toBeUndefined();
    });

    it('includes smoothing when smoothingTransformation toggle is on', () => {
      const mockConfig = jest.requireMock('@grafana/runtime');
      mockConfig.config.featureToggles.smoothingTransformation = true;

      try {
        const items = getStandardTransformers();
        const smoothing = items.find((i) => i.id === DataTransformerID.smoothing);
        expect(smoothing).toBeDefined();
      } finally {
        mockConfig.config.featureToggles.smoothingTransformation = false;
      }
    });
  });

  describe('isApplicable wiring', () => {
    it('wires heatmap isApplicable to isHeatmapApplicable', () => {
      const heatmap = getStandardTransformers().find((i) => i.id === DataTransformerID.heatmap);
      expect(heatmap?.isApplicable).toBe(isHeatmapApplicable);
    });

    it('wires smoothing isApplicable to isSmoothingApplicable when toggle is on', () => {
      const mockConfig = jest.requireMock('@grafana/runtime');
      mockConfig.config.featureToggles.smoothingTransformation = true;

      try {
        const smoothing = getStandardTransformers().find((i) => i.id === DataTransformerID.smoothing);
        expect(smoothing?.isApplicable).toBe(isSmoothingApplicable);
      } finally {
        mockConfig.config.featureToggles.smoothingTransformation = false;
      }
    });
  });

  describe('required fields on all items', () => {
    it('every item has a transformation function', () => {
      for (const item of getStandardTransformers()) {
        expect(typeof item.transformation).toBe('function');
      }
    });

    it('every item has an editor component defined', () => {
      for (const item of getStandardTransformers()) {
        expect(item.editor).toBeDefined();
      }
    });

    it('every visible item has non-empty name, imageDark, and imageLight', () => {
      const visible = getStandardTransformers().filter((i) => !i.excludeFromPicker);
      for (const item of visible) {
        expect(item.name.length).toBeGreaterThan(0);
        expect(typeof item.imageDark).toBe('string');
        expect(typeof item.imageLight).toBe('string');
      }
    });
  });

  describe('eager transformation resolution', () => {
    it('transformation() for reduce resolves to a DataTransformerInfo with operator', async () => {
      const reduce = getStandardTransformers().find((i) => i.id === DataTransformerID.reduce)!;
      const info = await reduce.transformation();
      expect(info.id).toBe(DataTransformerID.reduce);
      expect(typeof info.operator).toBe('function');
    });

    it('transformation() for merge resolves to a DataTransformerInfo with operator', async () => {
      const merge = getStandardTransformers().find((i) => i.id === DataTransformerID.merge)!;
      const info = await merge.transformation();
      expect(info.id).toBe(DataTransformerID.merge);
      expect(typeof info.operator).toBe('function');
    });
  });
});
