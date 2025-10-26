import Feature from 'ol/Feature';
import { Point, Polygon } from 'ol/geom';
import VectorSource from 'ol/source/Vector';

import { FieldType, createDataFrame } from '@grafana/data';

import { updateFeaturePropertiesForTooltip } from './geojsonDynamic';

describe('Dynamic GeoJSON Layer', () => {
  describe('updateFeaturePropertiesForTooltip', () => {
    let source: VectorSource;
    let idToIdx: Map<string, number>;
    let mockFeature1: Feature;
    let mockFeature2: Feature;
    let mockFeature3: Feature;
    let forEachFeatureSpy: jest.SpyInstance;

    beforeEach(() => {
      source = new VectorSource();
      idToIdx = new Map();
      
      // Create mock features with different IDs
      mockFeature1 = new Feature({
        geometry: new Point([0, 0]),
      });
      mockFeature1.setId('feature1');
      
      mockFeature2 = new Feature({
        geometry: new Polygon([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]),
      });
      mockFeature2.setId('feature2');
      
      mockFeature3 = new Feature({
        geometry: new Point([2, 2]),
      });
      mockFeature3.setId('feature3');
      
      // Add features to source
      source.addFeature(mockFeature1);
      source.addFeature(mockFeature2);
      source.addFeature(mockFeature3);
      
      // Set up spy for forEachFeature method
      forEachFeatureSpy = jest.spyOn(source, 'forEachFeature');
    });

    afterEach(() => {
      source.clear();
      idToIdx.clear();
      forEachFeatureSpy.mockRestore();
    });

    it('should update feature properties when frame and idField are provided', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['feature1', 'feature2', 'feature3'] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          { name: 'name', type: FieldType.string, values: ['First', 'Second', 'Third'] },
        ],
      });

      updateFeaturePropertiesForTooltip(source, frame, 'id', idToIdx);

      // Check that idToIdx map is populated correctly
      expect(idToIdx.get('feature1')).toBe(0);
      expect(idToIdx.get('feature2')).toBe(1);
      expect(idToIdx.get('feature3')).toBe(2);

      // Check that features have frame and rowIndex properties set
      expect(mockFeature1.get('frame')).toBe(frame);
      expect(mockFeature1.get('rowIndex')).toBe(0);
      
      expect(mockFeature2.get('frame')).toBe(frame);
      expect(mockFeature2.get('rowIndex')).toBe(1);
      
      expect(mockFeature3.get('frame')).toBe(frame);
      expect(mockFeature3.get('rowIndex')).toBe(2);
    });

    it('should handle partial matches between features and frame data', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['feature1', 'feature3'] }, // missing feature2
          { name: 'value', type: FieldType.number, values: [10, 30] },
        ],
      });

      updateFeaturePropertiesForTooltip(source, frame, 'id', idToIdx);

      // Check that only matching features have properties set
      expect(mockFeature1.get('frame')).toBe(frame);
      expect(mockFeature1.get('rowIndex')).toBe(0);
      
      expect(mockFeature2.get('frame')).toBeUndefined();
      expect(mockFeature2.get('rowIndex')).toBeUndefined();
      
      expect(mockFeature3.get('frame')).toBe(frame);
      expect(mockFeature3.get('rowIndex')).toBe(1);
    });

    it('should handle features with no matching data', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['nonexistent1', 'nonexistent2'] },
          { name: 'value', type: FieldType.number, values: [10, 20] },
        ],
      });

      updateFeaturePropertiesForTooltip(source, frame, 'id', idToIdx);

      // Check that no features have properties set since IDs don't match
      expect(mockFeature1.get('frame')).toBeUndefined();
      expect(mockFeature1.get('rowIndex')).toBeUndefined();
      
      expect(mockFeature2.get('frame')).toBeUndefined();
      expect(mockFeature2.get('rowIndex')).toBeUndefined();
      
      expect(mockFeature3.get('frame')).toBeUndefined();
      expect(mockFeature3.get('rowIndex')).toBeUndefined();
    });

    it('should clear idToIdx map on each call', () => {
      // First call
      const frame1 = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['feature1'] },
          { name: 'value', type: FieldType.number, values: [10] },
        ],
      });

      updateFeaturePropertiesForTooltip(source, frame1, 'id', idToIdx);
      expect(idToIdx.size).toBe(1);
      expect(idToIdx.get('feature1')).toBe(0);

      // Second call with different data
      const frame2 = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['feature2', 'feature3'] },
          { name: 'value', type: FieldType.number, values: [20, 30] },
        ],
      });

      updateFeaturePropertiesForTooltip(source, frame2, 'id', idToIdx);
      
      // Map should be cleared and repopulated
      expect(idToIdx.size).toBe(2);
      expect(idToIdx.get('feature1')).toBeUndefined();
      expect(idToIdx.get('feature2')).toBe(0);
      expect(idToIdx.get('feature3')).toBe(1);
    });

    it('should handle features with null or undefined IDs', () => {
      // Add a feature with no ID
      const featureWithoutId = new Feature({
        geometry: new Point([3, 3]),
      });
      source.addFeature(featureWithoutId);

      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['feature1', 'feature2'] },
          { name: 'value', type: FieldType.number, values: [10, 20] },
        ],
      });

      updateFeaturePropertiesForTooltip(source, frame, 'id', idToIdx);

      // Features with IDs should be processed
      expect(mockFeature1.get('frame')).toBe(frame);
      expect(mockFeature1.get('rowIndex')).toBe(0);

      // Feature without ID should not be processed
      expect(featureWithoutId.get('frame')).toBeUndefined();
      expect(featureWithoutId.get('rowIndex')).toBeUndefined();
    });

    it('should handle string and number IDs', () => {
      // Add features with number IDs
      const featureWithNumberId = new Feature({
        geometry: new Point([4, 4]),
      });
      featureWithNumberId.setId(123);
      source.addFeature(featureWithNumberId);

      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.number, values: [123, 456] },
          { name: 'value', type: FieldType.number, values: [100, 200] },
        ],
      });

      updateFeaturePropertiesForTooltip(source, frame, 'id', idToIdx);

      // Feature with number ID should be processed (converted to string)
      expect(featureWithNumberId.get('frame')).toBe(frame);
      expect(featureWithNumberId.get('rowIndex')).toBe(0);
    });

    it('should return early when frame is undefined', () => {
      updateFeaturePropertiesForTooltip(source, undefined, 'id', idToIdx);
      
      expect(forEachFeatureSpy).not.toHaveBeenCalled();
      expect(idToIdx.size).toBe(0);
    });

    it('should return early when idField is undefined', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['feature1'] },
          { name: 'value', type: FieldType.number, values: [10] },
        ],
      });
      
      updateFeaturePropertiesForTooltip(source, frame, undefined, idToIdx);
      
      expect(forEachFeatureSpy).not.toHaveBeenCalled();
      expect(idToIdx.size).toBe(0);
    });

    it('should return early when idField is empty string', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['feature1'] },
          { name: 'value', type: FieldType.number, values: [10] },
        ],
      });
      
      updateFeaturePropertiesForTooltip(source, frame, '', idToIdx);
      
      expect(forEachFeatureSpy).not.toHaveBeenCalled();
      expect(idToIdx.size).toBe(0);
    });

    it('should handle when idField does not exist in frame', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'different_field', type: FieldType.string, values: ['feature1'] },
          { name: 'value', type: FieldType.number, values: [10] },
        ],
      });
      
      updateFeaturePropertiesForTooltip(source, frame, 'nonexistent_field', idToIdx);
      
      expect(forEachFeatureSpy).not.toHaveBeenCalled();
      expect(idToIdx.size).toBe(0);
    });

    it('should preserve existing feature properties while adding tooltip properties', () => {
      // Set some existing properties on the feature
      mockFeature1.set('existingProperty', 'existing value');
      mockFeature1.set('anotherProperty', 42);

      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['feature1'] },
          { name: 'value', type: FieldType.number, values: [10] },
        ],
      });

      updateFeaturePropertiesForTooltip(source, frame, 'id', idToIdx);

      // Check that existing properties are preserved
      expect(mockFeature1.get('existingProperty')).toBe('existing value');
      expect(mockFeature1.get('anotherProperty')).toBe(42);
      
      // Check that tooltip properties are added
      expect(mockFeature1.get('frame')).toBe(frame);
      expect(mockFeature1.get('rowIndex')).toBe(0);
    });
  });
}); 
