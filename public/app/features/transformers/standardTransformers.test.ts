import { type ComponentType } from 'react';

import { DataTransformerID, type TransformerRegistryItem, type TransformerUIProps } from '@grafana/data';

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
  function isLazyComponent(component: ComponentType<TransformerUIProps<unknown>>): boolean {
    // @ts-ignore - $$typeof is an internal React property which we use here for identifying that the component is a lazy component
    return component && typeof component === 'object' && component.$$typeof === Symbol.for('react.lazy');
  }

  function defaultAssertions(item: TransformerRegistryItem) {
    it('editor is a React lazy component', () => {
      expect(isLazyComponent(item.editor)).toBe(true);
    });

    it('transformation resolves to a DataTransformerInfo', async () => {
      const info = await item.transformation();
      expect(info).toBeDefined();
      expect(typeof info.operator).toBe('function');
    });

    // append intentionally reuses the noop transformer, so resolved id differs
    if (item && item.id !== DataTransformerID.append) {
      it('transformation id is the same as item.id', async () => {
        const info = await item.transformation();
        expect(info.id).toBe(item.id);
      });
    }
  }

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

  describe.each(getStandardTransformers())('standard transformer for $id', (item) => defaultAssertions(item));

  describe('smoothing feature toggle', () => {
    describe('toggle off', () => {
      it('excludes smoothing when smoothingTransformation toggle is off', () => {
        const items = getStandardTransformers();
        expect(items.find((i) => i.id === DataTransformerID.smoothing)).toBeUndefined();
      });
    });

    describe('toggle on', () => {
      const mockConfig = jest.requireMock('@grafana/runtime');
      mockConfig.config.featureToggles.smoothingTransformation = true;
      const smoothing = getStandardTransformers().find((i) => i.id === DataTransformerID.smoothing);
      try {
        defaultAssertions(smoothing!);
      } finally {
        mockConfig.config.featureToggles.smoothingTransformation = false;
      }
    });
  });

  describe('isApplicable', () => {
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
    it.each([DataTransformerID.reduce, DataTransformerID.merge])(
      'resolves %s transformation without error and includes operator',
      async (id) => {
        const item = getStandardTransformers().find((i) => i.id === id);
        expect(item).toBeDefined();
        const info = await item!.transformation();
        expect(info).toBeDefined();
        expect(typeof info.operator).toBe('function');
      }
    );
  });
});
