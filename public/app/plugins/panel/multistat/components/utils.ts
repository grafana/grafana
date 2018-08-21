import tinycolor from 'tinycolor2';

export function getBGColor(color: string, alpha = 0.3): string {
  const tc = tinycolor(color);
  tc.setAlpha(alpha);
  return tc.toRgbString();
}

const FONT_SIZE_FACTOR = 1.0;

export function getFontSize(text: string, elemWidth: number, elemHeight = +Infinity): number {
  const MAX_TEXT_WIDTH = 1.0;
  const MAX_TEXT_HEIGHT = 0.4;
  const textLength = text.length || 1;
  const textCellWidth = elemWidth * MAX_TEXT_WIDTH / textLength;
  const textCellHeight = elemHeight * MAX_TEXT_HEIGHT;
  const textCellSize = Math.min(textCellWidth, textCellHeight) * FONT_SIZE_FACTOR;
  return Math.round(textCellSize);
}

export function isValuesOutOfBar(elemWidth: number, fontSize: number, textLength: number): boolean {
  const maxTextLength = 0.9;
  const textWidth = fontSize * textLength / FONT_SIZE_FACTOR;
  return textWidth > elemWidth * maxTextLength;
}
