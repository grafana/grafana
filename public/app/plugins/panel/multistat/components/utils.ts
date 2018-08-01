import tinycolor from 'tinycolor2';

export function getBGColor(color: string, alpha = 0.3): string {
  const tc = tinycolor(color);
  tc.setAlpha(alpha);
  return tc.toRgbString();
}

const fontSizeFactor = 1.0;

export function getFontSize(minTextCellWidth: number, elemHeight: number): number {
  const maxTextWidthPercent = 100;
  const maxTextHeightPercent = 40;
  const textCellWidth = minTextCellWidth * maxTextWidthPercent / 100;
  const textCellHeight = elemHeight * maxTextHeightPercent / 100;
  const textCellSize = Math.min(textCellWidth, textCellHeight);
  return Math.round(textCellSize * fontSizeFactor);
}

export function isValuesOutOfBar(
  elemWidth: number,
  elemHeight: number,
  minTextCellWidth: number,
  textLength: number
): boolean {
  const maxTextLengthPercent = 90;
  const textCellSize = getFontSize(minTextCellWidth, elemHeight) / fontSizeFactor;
  return textCellSize * textLength > elemWidth * maxTextLengthPercent / 100;
}
