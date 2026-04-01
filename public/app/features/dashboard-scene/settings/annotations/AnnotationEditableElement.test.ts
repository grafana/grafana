import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { activateFullSceneTree } from '../../utils/test-utils';

import { AnnotationEditableElement, type AnnotationLayer } from './AnnotationEditableElement';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({}),
  })),
}));

function createAnnotation(overrides: Partial<DashboardAnnotationsDataLayer['state']> = {}): AnnotationLayer {
  return new DashboardAnnotationsDataLayer({
    key: 'test-annotation',
    name: 'Test annotation',
    isEnabled: true,
    isHidden: false,
    query: {
      enable: true,
      name: 'Test annotation',
      iconColor: 'red',
    },
    ...overrides,
  });
}

function buildTestLayerSet(annotationLayers: AnnotationLayer[]) {
  const dataLayerSet = new DashboardDataLayerSet({ annotationLayers });
  dataLayerSet.activate();
  return dataLayerSet;
}

function buildTestScene($data: DashboardDataLayerSet) {
  const dashboard = new DashboardScene({ $data });
  activateFullSceneTree(dashboard);
  return dashboard;
}

describe('AnnotationEditableElement', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onDuplicate', () => {
    describe('when the annotation is in a DashboardDataLayerSet', () => {
      test('adds a clone', () => {
        const annotations = [
          createAnnotation({ key: 'annotation-1', name: 'Test annotation 1' }),
          createAnnotation({ key: 'annotation-2', name: 'Test annotation 2' }),
        ];
        const layerSet = buildTestLayerSet(annotations);
        buildTestScene(layerSet);

        const element = new AnnotationEditableElement(annotations[0]);
        element.onDuplicate();

        expect(layerSet.state.annotationLayers).toHaveLength(3);

        const cloned = layerSet.state.annotationLayers[2] as DashboardAnnotationsDataLayer;
        expect(cloned).toBeInstanceOf(DashboardAnnotationsDataLayer);

        expect(cloned).not.toBe(annotations[0]);
        expect(cloned.state.key).not.toBe(annotations[0].state.key);

        expect(cloned.state.name).toBe(`${annotations[0].state.name} - Copy`);
        expect(cloned.state.query).toEqual(annotations[0].state.query);
      });
    });
  });

  describe('onDelete', () => {
    describe('when the annotation is in a DashboardDataLayerSet', () => {
      test('removes it', () => {
        const annotations = [
          createAnnotation({ key: 'annotation-1', name: 'Test annotation 1' }),
          createAnnotation({ key: 'annotation-2', name: 'Test annotation 2' }),
        ];
        const layerSet = buildTestLayerSet(annotations);
        buildTestScene(layerSet);

        const element = new AnnotationEditableElement(annotations[0]);
        element.onDelete();

        expect(layerSet.state.annotationLayers).toHaveLength(1);
        expect(layerSet.state.annotationLayers[0]).toBe(annotations[1]);
      });
    });
  });
});
