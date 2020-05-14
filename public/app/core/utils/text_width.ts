export function getTextWidth(text: string, elem: HTMLElement, padding = true): number {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const style = window.getComputedStyle(elem);
  context.font = getFontFromComputedStyle(style);
  let width = context.measureText(text).width;
  if (padding) {
    width = accountPadding(width, style);
  }
  return Math.ceil(width);
}

export function getFontFromComputedStyle(style: CSSStyleDeclaration): string {
  let font = style.font;
  // Firefox returns the empty string for .font, so create the .font property manually
  if (font === '') {
    const fontStretch = convFontStretch(style.fontStretch);
    font =
      style.fontStyle +
      ' ' +
      style.fontVariant +
      ' ' +
      style.fontWeight +
      ' ' +
      fontStretch +
      ' ' +
      style.fontSize +
      '/' +
      style.lineHeight +
      ' ' +
      style.fontFamily;
  }
  return font;
}

function convFontStretch(key: string): string {
  const last = key.charAt(key.length - 1);
  if (last !== '%') {
    return key;
  }

  // Firefox uses percentages for font-stretch,
  // but Canvas does not accept percentages
  // so convert to keywords, as listed at:
  // https://developer.mozilla.org/en-US/docs/Web/CSS/font-stretch
  switch (key) {
    case '50%':
      return 'ultra-condensed';
    case '62.5%':
      return 'extra-condensed';
    case '75%':
      return 'condensed';
    case '87.5%':
      return 'semi-condensed';
    case '100%':
      return 'normal';
    case '112.5%':
      return 'semi-expanded';
    case '125%':
      return 'expanded';
    case '150%':
      return 'extra-expanded';
    case '200%':
      return 'ultra-expanded';
  }
  // If the retrieved font-stretch percentage isn't found in the lookup table,
  // use 'normal' as a last resort.
  return 'normal';
}

function accountPadding(width: number, style: CSSStyleDeclaration): number {
  const l = padToNum(style.paddingLeft);
  const r = padToNum(style.paddingRight);
  width /= 1 - (l.pc + r.pc);
  width += l.px + r.px;
  return width;
}

function padToNum(pad: string): { px: number; pc: number } {
  let px = 0;
  let pc = 0; // percent
  if (pad) {
    if (pad.endsWith('%')) {
      pc = Number(pad.slice(0, -1)) || 0;
      pc /= 100;
    } else if (pad.endsWith('px')) {
      px = Number(pad.slice(0, -2)) || 0;
    }
  }
  return { px, pc };
}
