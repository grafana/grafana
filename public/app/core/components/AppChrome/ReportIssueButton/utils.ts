export function isCanvas(obj: HTMLCanvasElement | HTMLElement): obj is HTMLCanvasElement {
  return obj && obj.tagName === 'CANVAS';
}
