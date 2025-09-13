import { useEffect, useRef } from 'react';
export interface Props {
  children: React.ReactNode;
  onSetScrollRef?: (ref: ScrollRefElement) => void;
  divId?: string;
}

export interface ScrollRefElement {
  scrollTop: number;
  scrollTo: (x: number, y: number) => void;
  cleanup?: () => void;
}

// Shim to provide API-compatibility for Page's scroll-related props
export default function NativeScrollbar({ children, onSetScrollRef, divId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<DivScrollElement | null>(null);

  useEffect(() => {
    scrollElementRef.current = new DivScrollElement(document.documentElement);
    onSetScrollRef?.(scrollElementRef.current);

    // Cleanup function to clear references and cancel any pending animation frames
    return () => {
      scrollElementRef.current?.cleanup();
      scrollElementRef.current = null;

      onSetScrollRef?.(null as any); // Clear the parent reference
    };
  }, [ref, onSetScrollRef]);

  return children;
}

class DivScrollElement {
  private pendingAnimationFrame: number | null = null;
  private element: HTMLElement | null = null;

  public constructor(_element: HTMLElement) {
    this.element = _element;
  }
  
  public get scrollTop() {
    if(!this.element) return 0;

    return this.element.scrollTop;
  }

  public scrollTo(x: number, y: number, retry = 0) {
    if(!this.element) return;

    // If the element does not have the height we wait a few frames and look again
    // Gives the view time to render and get the correct height before we restore scroll position
    const canScroll = this.element.scrollHeight - this.element.clientHeight - y >= 0;

    if (!canScroll && retry < 10) {
      this.pendingAnimationFrame = requestAnimationFrame(() => this.scrollTo(x, y, retry + 1));
      return;
    }

    this.element.scrollTo(x, y);
  }

  public cleanup() {
    // Cancel any pending animation frame
    if (this.pendingAnimationFrame) {
      cancelAnimationFrame(this.pendingAnimationFrame);
      this.pendingAnimationFrame = null;
    }
    
    // Clear the element reference
    this.element = null as any;
  }
}
