import { act, render } from '@testing-library/react';
import { Suspense, type ComponentType } from 'react';

import {
  standardTransformersRegistry,
  DataTransformerID,
  type TransformerRegistryItem,
  type TransformerUIProps,
} from '@grafana/data';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      smoothingTransformation: false,
    },
  },
  getTemplateSrv: () => ({
    getVariables: () => [],
    replace: (s: string) => s,
  }),
}));

// Prevent editors that load external assets (e.g. spatial/heatmap gazetteer) from making
// real network requests in jsdom. Return an empty GeoJSON FeatureCollection so the
// gazetteer loader produces a valid (empty) result without warnings.
global.fetch = jest.fn(() =>
  Promise.resolve(new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 }))
);

import { isHeatmapApplicable } from './calculateHeatmap/applicability';
import { isSmoothingApplicable } from './smoothing/applicability';
import { getStandardTransformers } from './standardTransformers';

describe('getStandardTransformers', () => {
  beforeAll(() => {
    standardTransformersRegistry.setInit(getStandardTransformers);
  });

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
    if (item.id !== DataTransformerID.append) {
      it('transformation id is the same as item.id', async () => {
        const info = await item.transformation();
        expect(info.id).toBe(item.id);
      });
    }

    if (!item.excludeFromPicker) {
      it('visible editor mounts without throwing', async () => {
        const info = await item.transformation();
        const options = { ...(info.defaultOptions ?? {}), ...(item.defaultOptions ?? {}) };
        const Editor = item.editor;
        await act(async () => {
          render(
            <Suspense fallback={null}>
              <Editor options={options} input={[]} onChange={() => {}} />
            </Suspense>
          );
        });
      });

      it('visible item has non-empty name, imageDark, and imageLight', () => {
        expect(item.name.length).toBeGreaterThan(0);
        expect(typeof item.imageDark).toBe('string');
        expect(typeof item.imageLight).toBe('string');
      });
    } else {
      it('hidden item has empty image and description fields', () => {
        expect(item.imageDark).toBe('');
        expect(item.imageLight).toBe('');
        expect(item.description).toBe('');
      });
    }
  }

  describe.each(getStandardTransformers())('standard transformer for $id', defaultAssertions);

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

  describe('isApplicable invariant', () => {
    it('if DataTransformerInfo.isApplicable is defined, TransformerRegistryItem.isApplicable must also be defined', async () => {
      const items = getStandardTransformers();
      for (const item of items) {
        const info = await item.transformation();
        if (info.isApplicable !== undefined) {
          expect(item.isApplicable).toBeDefined();
        }
      }
    });

    it('if DataTransformerInfo.isApplicableDescription is defined, TransformerRegistryItem.isApplicableDescription must also be defined', async () => {
      const items = getStandardTransformers();
      for (const item of items) {
        const info = await item.transformation();
        if (info.isApplicableDescription !== undefined) {
          expect(item.isApplicableDescription).toBeDefined();
        }
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
