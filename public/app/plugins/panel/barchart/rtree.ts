import RBush from 'rbush';
import { Rect } from './quadtree';

export class BarTree extends RBush<Rect> {
  toBBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
    return {
      minX: x,
      minY: y,
      maxX: x + w,
      maxY: y + h,
    };
  }

  compareMinX(a: Rect, b: Rect) {
    return a.x - b.x;
  }

  compareMinY(a: Rect, b: Rect) {
    return a.y - b.y;
  }
}
