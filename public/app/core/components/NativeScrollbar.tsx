import { useEffect, useRef } from 'react';
export interface Props {
  children: React.ReactNode;
  onSetScrollRef?: (ref: ScrollRefElement) => void;
  divId?: string;
}

export interface ScrollRefElement {
  scrollTop: number;
  scrollTo: (x: number, y: number) => void;
}

// Shim to provide API-compatibility for Page's scroll-related props
export default function NativeScrollbar({ children, onSetScrollRef, divId }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onSetScrollRef) {
      onSetScrollRef(new DivScrollElement(document.documentElement));
    }
  }, [ref, onSetScrollRef]);

  return children;
}

export class DivScrollElement implements ScrollRefElement {
  public constructor(private element: HTMLElement) {}
  public get scrollTop() {
    return this.element.scrollTop;
  }

  public scrollTo(x: number, y: number, retry = 0) {
    // If the element does not have the height we wait a few frames and look again
    // Gives the view time to render and get the correct height before we restore scroll position
    const canScroll = this.element.scrollHeight - this.element.clientHeight - y >= 0;

    if (!canScroll && retry < 10) {
      requestAnimationFrame(() => this.scrollTo(x, y, retry + 1));
      return;
    }

    this.element.scrollTo(x, y);
  }
}
