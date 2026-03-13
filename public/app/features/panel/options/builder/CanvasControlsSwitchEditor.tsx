import { StandardEditorProps } from '@grafana/data';
import { AnnotationDisplayOptions, VizAnnotations } from '@grafana/schema/dist/esm/common/common.gen';
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
      value={isEnabled(value)}
      onChange={(event) =>
        onChange(
          event?.currentTarget.checked
            ? { ...value, canvasControls: CANVAS_CONTROLS_ENABLED }
            : { ...value, canvasControls: CANVAS_CONTROLS_DISABLED }
        )
      }
    />
  );
};

const isEnabled = (options: VizAnnotations | undefined): boolean => {
  const value = options?.canvasControls;

  // If multiLane is enabled we do not render canvas controls until the user has set a value
  if (value === undefined) {
    return !options?.multiLane;
  }

  if (!value.regions.opacity || !value.lines.width) {
    return false;
  }

  return value.regions.opacity > 0 && value.lines.width > 0;
};
