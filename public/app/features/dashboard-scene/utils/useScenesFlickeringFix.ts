import { useFlagGrafanaScenesFlickeringFix } from '@grafana/runtime/internal';
import { SceneObjectBase } from '@grafana/scenes';

export function useScenesFlickeringFix() {
  const scenesFlickeringFix = useFlagGrafanaScenesFlickeringFix();
  if (scenesFlickeringFix) {
    SceneObjectBase.RENDER_BEFORE_ACTIVATION_DEFAULT = true;
  }
}
