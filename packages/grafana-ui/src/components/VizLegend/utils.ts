import { SeriesVisibilityChangeMode } from '..';

export function mapMouseEventToMode(event: React.MouseEvent): SeriesVisibilityChangeMode {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return SeriesVisibilityChangeMode.AppendToSelection;
  }
  return SeriesVisibilityChangeMode.ToggleSelection;
}
