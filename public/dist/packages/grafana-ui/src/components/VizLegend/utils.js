import { SeriesVisibilityChangeMode } from '..';
export function mapMouseEventToMode(event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
        return SeriesVisibilityChangeMode.AppendToSelection;
    }
    return SeriesVisibilityChangeMode.ToggleSelection;
}
//# sourceMappingURL=utils.js.map