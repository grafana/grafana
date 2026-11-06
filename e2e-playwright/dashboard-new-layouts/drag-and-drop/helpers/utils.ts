import { getPanelBox, type Point } from '../../helpers';
import { type Panels } from '../../page-objects';

/** Box of every given panel, keyed by title, to compare a whole layout before and after a change */
export async function getPanelBoxes(
  panels: Panels,
  panelTitles: string[]
): Promise<Record<string, { x: number; y: number; width: number; height: number }>> {
  const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const title of panelTitles) {
    boxes[title] = await getPanelBox(panels, title);
  }

  return boxes;
}

/**
 * A point in the left or right half of a panel, a quarter of its width in from that edge and
 * vertically centered: hovering it while dragging aims the drop before or after that panel
 */
export async function getPanelHalfPoint(panels: Panels, panelTitle: string, half: 'left' | 'right'): Promise<Point> {
  const box = await getPanelBox(panels, panelTitle);

  return {
    x: box.x + box.width * (half === 'left' ? 0.25 : 0.75),
    y: box.y + box.height / 2,
  };
}
