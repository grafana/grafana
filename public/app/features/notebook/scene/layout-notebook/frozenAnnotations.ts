import { uniqueId } from 'lodash';
import { type Observable, of } from 'rxjs';

import {
  type AnnotationQuery,
  type DataFrame,
  type DataFrameJSON,
  type DataQueryResponse,
  dataFrameFromJSON,
  dataFrameToJSON,
  LoadingState,
} from '@grafana/data';
import { dataLayers, RuntimeDataSource, SceneDataLayerSet, type SceneObject } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { defaultDataQueryKind } from '@grafana/schema/apis/notebook/v2beta1';

import { type PanelKind } from '../../types';

export type PanelAnnotations = NonNullable<PanelKind['spec']['annotations']>;
type PanelAnnotation = PanelAnnotations[number];

// The shape dashboard snapshots give a panel's captured data: frames stored on the query itself.
const SNAPSHOT_QUERY_TYPE = 'snapshot';

interface FrozenEventsQuery extends DataQuery {
  queryType: typeof SNAPSHOT_QUERY_TYPE;
  snapshot: DataFrameJSON[];
}

/** What a frozen annotation keeps from the layer its events came from. */
export type FrozenAnnotationSource = Pick<AnnotationQuery, 'name' | 'iconColor' | 'hide'>;

/**
 * An annotation layer that replays the events a panel showed on its dashboard when it was added.
 * Notebooks have no annotation layers of their own, so this is the only kind a cell holds, and it
 * never queries anything.
 *
 * The stored events still go through everything a live layer does to them (colours, alert states,
 * regions, dedup), because the layer is handed a datasource that answers with them.
 */
export class FrozenAnnotationsDataLayer extends dataLayers.AnnotationsDataLayer {
  protected async resolveDataSource(query: AnnotationQuery) {
    return new FrozenEventsDataSource(isFrozenEventsQuery(query.target) ? query.target.snapshot : []);
  }
}

class FrozenEventsDataSource extends RuntimeDataSource {
  // Present so scenes takes its standard path, mapping the frames back to events, rather than the
  // deprecated annotationQuery one.
  annotations = {};

  constructor(private readonly frames: DataFrameJSON[]) {
    super('notebook-frozen-annotations', 'notebook-frozen-annotations');
  }

  query(): Observable<DataQueryResponse> {
    return of({ data: this.frames.map((frame) => dataFrameFromJSON(frame)), state: LoadingState.Done });
  }
}

// Set on every event as a layer processes it, so they are dropped rather than stored.
const FIELDS_SET_ON_REPLAY = new Set(['source', 'color', 'type', 'isRegion']);

/** Freezes the events one layer showed. The frames are the processed ones a panel's data holds. */
export function freezeAnnotation(source: FrozenAnnotationSource, frames: DataFrame[]): PanelAnnotation {
  const snapshot = frames.map((frame) =>
    dataFrameToJSON({ ...frame, fields: frame.fields.filter((field) => !FIELDS_SET_ON_REPLAY.has(field.name)) })
  );

  return frozenAnnotationKind(source, { refId: 'Anno', queryType: SNAPSHOT_QUERY_TYPE, snapshot });
}

function frozenAnnotationKind(source: FrozenAnnotationSource, target: FrozenEventsQuery): PanelAnnotation {
  return {
    kind: 'AnnotationQuery',
    spec: {
      name: source.name,
      enable: true,
      hide: Boolean(source.hide),
      iconColor: source.iconColor,
      query: {
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group: 'grafana',
        spec: target,
      },
    },
  };
}

/**
 * The cell's layers, or undefined when it has none. Anything that is not a frozen annotation is
 * skipped: a notebook has no live layers, and nothing writes one.
 */
export function deserializeFrozenAnnotations(annotations: PanelAnnotations | undefined): SceneDataLayerSet | undefined {
  const layers = (annotations ?? []).flatMap((annotation) => {
    const target = annotation.spec.query.spec;
    if (!isFrozenEventsQuery(target)) {
      return [];
    }

    const { name, iconColor, hide } = annotation.spec;
    return [
      new FrozenAnnotationsDataLayer({
        key: uniqueId('frozen-annotations-'),
        name,
        isEnabled: true,
        isHidden: hide,
        query: { name, iconColor, hide, enable: true, target },
      }),
    ];
  });

  return layers.length > 0 ? new SceneDataLayerSet({ layers }) : undefined;
}

export function serializeFrozenAnnotations(data: SceneObject | undefined): PanelAnnotations | undefined {
  if (!(data instanceof SceneDataLayerSet)) {
    return undefined;
  }

  const annotations = data.state.layers.flatMap((layer) => {
    if (!(layer instanceof FrozenAnnotationsDataLayer)) {
      return [];
    }

    const { query } = layer.state;
    return isFrozenEventsQuery(query.target) ? [frozenAnnotationKind(query, query.target)] : [];
  });

  return annotations.length > 0 ? annotations : undefined;
}

function isFrozenEventsQuery(target: unknown): target is FrozenEventsQuery {
  return (
    typeof target === 'object' &&
    target !== null &&
    'queryType' in target &&
    target.queryType === SNAPSHOT_QUERY_TYPE &&
    'snapshot' in target &&
    Array.isArray(target.snapshot)
  );
}
