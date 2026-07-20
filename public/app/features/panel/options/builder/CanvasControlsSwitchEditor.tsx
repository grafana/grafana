import { type StandardEditorProps } from '@grafana/data';
import { type AnnotationDisplayOptions, type VizAnnotations } from '@grafana/schema/dist/esm/common/common.gen';
import { Switch } from '@grafana/ui';

const DEFAULT_INDICATOR_LINE_WIDTH = 2;
const DEFAULT_REGION_OPACITY = 0.1;
export const CANVAS_CONTROLS_ENABLED: AnnotationDisplayOptions = {
  lines: { width: DEFAULT_INDICATOR_LINE_WIDTH },
  regions: { opacity: DEFAULT_REGION_OPACITY },
};
export const CANVAS_CONTROLS_DISABLED: AnnotationDisplayOptions = { lines: { width: 0 }, regions: { opacity: 0 } };

export const CanvasControlsSwitchEditor = ({
  onChange,
  value,
  id,
}: StandardEditorProps<VizAnnotations | undefined>) => {
  return (
    <Switch
      id={id}
      value={isHidden(value)}
      onChange={(event) => onChange(event?.currentTarget.checked ? CANVAS_CONTROLS_DISABLED : CANVAS_CONTROLS_ENABLED)}
    />
  );
};

const isHidden = (options: VizAnnotations | undefined): boolean => {
  // If multiLane is enabled we do not render canvas controls until the user has set a value
  if (options?.regions === undefined && options?.lines === undefined) {
    return !!options?.multiLane;
  }

  if (options?.regions?.opacity && options?.lines?.width) {
    return false;
  }

  return true;
};
