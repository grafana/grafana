import tinycolor from 'tinycolor2';

export function getBGColor(color: string, alpha = 0.3): string {
  const tc = tinycolor(color);
  tc.setAlpha(alpha);
  return tc.toRgbString();
}
