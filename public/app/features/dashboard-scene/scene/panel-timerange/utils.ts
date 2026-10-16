import type { PanelTimeRangeState } from './PanelTimeRange';

/**
 * Whether a panel should use a hover header, used when there's
 * nothing always-visible to display in it (no title, no visible time override).
 * return true hides the header, return false displays the header
 */
export function getUpdatedHoverHeader(title: string, timeOverride?: Partial<PanelTimeRangeState>): boolean {
  if (title !== '') {
    return false;
  }

  if (timeOverride && !timeOverride.hideTimeOverride) {
    if (timeOverride.timeFrom || timeOverride.timeShift || timeOverride.compareWith) {
      return false;
    }
  }

  return true;
}
