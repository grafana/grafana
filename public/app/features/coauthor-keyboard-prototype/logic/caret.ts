// Measures the pixel coordinates of a character offset inside a <textarea>,
// so the keyboard popover can be anchored to the caret / selection. Standard
// "mirror div" technique: clone the textarea's text + styles into a hidden div
// and read back the offset of a marker span.

const MIRRORED_PROPS = [
  'box-sizing',
  'width',
  'height',
  'overflow-x',
  'overflow-y',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'font-size',
  'line-height',
  'font-family',
  'text-align',
  'text-transform',
  'text-indent',
  'letter-spacing',
  'word-spacing',
  'tab-size',
  'white-space',
  'word-wrap',
];

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(element: HTMLTextAreaElement, position: number): CaretCoordinates {
  const div = document.createElement('div');
  const style = div.style;
  const computed = window.getComputedStyle(element);

  style.position = 'absolute';
  style.visibility = 'hidden';
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  MIRRORED_PROPS.forEach((prop) => {
    style.setProperty(prop, computed.getPropertyValue(prop));
  });

  document.body.appendChild(div);
  div.textContent = element.value.substring(0, position);

  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  const borderTop = parseInt(computed.getPropertyValue('border-top-width') || '0', 10);
  const borderLeft = parseInt(computed.getPropertyValue('border-left-width') || '0', 10);
  const lineHeight = parseInt(computed.getPropertyValue('line-height') || '16', 10);

  const coordinates: CaretCoordinates = {
    top: span.offsetTop + borderTop - element.scrollTop,
    left: span.offsetLeft + borderLeft - element.scrollLeft,
    height: Number.isNaN(lineHeight) ? 16 : lineHeight,
  };

  document.body.removeChild(div);
  return coordinates;
}
