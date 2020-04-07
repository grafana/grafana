// Slightly modified, but without dependancies:
// https://raw.githubusercontent.com/malte-wessel/react-custom-scrollbars/master/src/utils/getScrollbarWidth.js
let scrollbarWidth: number | null = null;

export default function getScrollbarWidth() {
  if (scrollbarWidth !== null) {
    return scrollbarWidth;
  }

  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    const newStyles = {
      width: '100px',
      height: '100px',
      position: 'absolute',
      top: '-9999px',
      overflow: 'scroll',
      MsOverflowStyle: 'scrollbar',
    };

    Object.keys(newStyles).map(style => {
      // @ts-ignore
      div.style[style] = newStyles[style];
    });

    document.body.appendChild(div);
    scrollbarWidth = div.offsetWidth - div.clientWidth;
    document.body.removeChild(div);
  } else {
    scrollbarWidth = 0;
  }
  return scrollbarWidth || 0;
}

const hasNoOverlayScrollbars = getScrollbarWidth() > 0;

export const addClassIfNoOverlayScrollbar = (classname: string, htmlElement: HTMLElement = document.body) => {
  if (hasNoOverlayScrollbars) {
    htmlElement.classList.add(classname);
  }
};
