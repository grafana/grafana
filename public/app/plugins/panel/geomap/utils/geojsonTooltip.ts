import type VectorSource from 'ol/source/Vector';

import { type DataFrame } from '@grafana/data';
import { findField } from 'app/features/dimensions/utils';

/**
 * Helper function to update feature properties for tooltip support
 * @param source - OpenLayers vector source containing features
 * @param frame - DataFrame containing the data
 * @param idField - Field name to use for matching feature IDs
 * @param idToIdx - Map to store ID to row index mappings
 */
export function updateFeaturePropertiesForTooltip(
  source: VectorSource,
  frame: DataFrame | undefined,
  idField: string | undefined,
  idToIdx: Map<string, number>
): void {
  if (!frame || !idField) {
    return;
  }

  const field = findField(frame, idField);
  if (field) {
    idToIdx.clear();
    field.values.forEach((v, i) => idToIdx.set(String(v), i));

    source.forEachFeature((feature) => {
      const featureId = feature.getId();
      if (featureId != null) {
        const rowIndex = idToIdx.get(String(featureId));
        if (rowIndex !== undefined) {
          // Set tooltip properties without overwriting existing GeoJSON properties
          feature.set('frame', frame);
          feature.set('rowIndex', rowIndex);
        }
      }
    });
  }
}
