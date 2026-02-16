import { AnnotationQuery, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  SceneDataLayerProviderState,
  SceneDataLayerProvider,
  SceneDataLayerSetBase,
  SceneComponentProps,
} from '@grafana/scenes';

import { AlertStatesDataLayer } from './AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DataLayerControl } from './DataLayerControl';

export const NEW_ANNOTATION_NAME = 'New annotation';
const NEW_ANNOTATION_COLOR = 'red';

export interface DashboardDataLayerSetState extends SceneDataLayerProviderState {
  alertStatesLayer?: AlertStatesDataLayer;
  annotationLayers: SceneDataLayerProvider[];
}

export class DashboardDataLayerSet
  extends SceneDataLayerSetBase<DashboardDataLayerSetState>
  implements SceneDataLayerProvider
{
  public static Component = DashboardDataLayerSetRenderer;

  public constructor(state: Partial<DashboardDataLayerSetState>) {
    super({
      ...state,
      name: state.name ?? 'Data layers',
      annotationLayers: state.annotationLayers ?? [],
    });

    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    this._subs.add(
      this.subscribeToState((newState, oldState) => {
        if (newState.annotationLayers !== oldState.annotationLayers) {
          this.querySub?.unsubscribe();
          this.subscribeToAllLayers(this.getAllLayers());
        }
      })
    );

    this.subscribeToAllLayers(this.getAllLayers());

    return () => {
      this.querySub?.unsubscribe();
    };
  }

  public addAnnotationLayer(layer: SceneDataLayerProvider) {
    this.setState({ annotationLayers: [...this.state.annotationLayers, layer] });
  }

  public createDefaultAnnotationLayer(): DashboardAnnotationsDataLayer {
    const defaultDatasource = getDataSourceSrv().getInstanceSettings(null);
    const datasourceRef = defaultDatasource?.meta.annotations ? getDataSourceRef(defaultDatasource) : undefined;

    const newAnnotationQuery: AnnotationQuery = {
      enable: true,
      datasource: datasourceRef,
      name: NEW_ANNOTATION_NAME,
      iconColor: NEW_ANNOTATION_COLOR,
    };

    return new DashboardAnnotationsDataLayer({
      query: newAnnotationQuery,
      name: newAnnotationQuery.name,
      isEnabled: true,
      isHidden: false,
    });
  }

  private getAllLayers() {
    const layers = [...this.state.annotationLayers];

    if (this.state.alertStatesLayer) {
      layers.push(this.state.alertStatesLayer);
    }

    return layers;
  }
}

function DashboardDataLayerSetRenderer({ model }: SceneComponentProps<DashboardDataLayerSet>) {
  const { annotationLayers } = model.useState();

  return (
    <>
      {annotationLayers.map((layer) => (
        <DataLayerControl layer={layer} key={layer.state.key} />
      ))}
    </>
  );
}

export function isDashboardDataLayerSetState(data: unknown): data is DashboardDataLayerSetState {
  if (data && typeof data === 'object') {
    return 'annotationLayers' in data;
  }

  return false;
}

export function isDashboardDataLayerSet(obj: unknown): obj is DashboardDataLayerSet {
  return obj instanceof DashboardDataLayerSet;
}
