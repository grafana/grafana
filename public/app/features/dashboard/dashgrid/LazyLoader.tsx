import React, { useId, useRef, useState } from 'react';
import { useEffectOnce } from 'react-use';

export interface Props {
  children: React.ReactNode | (({ isInView }: { isInView: boolean }) => React.ReactNode);
  width?: number;
  height?: number;
  onLoad?: () => void;
  onChange?: (isInView: boolean) => void;
}

export function LazyLoader({ children, width, height, onLoad, onChange }: Props) {
  const id = useId();
  const [loaded, setLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffectOnce(() => {
    LazyLoader.addCallback(id, (entry) => {
      if (!loaded && entry.isIntersecting) {
        setLoaded(true);
        onLoad?.();
      }

      setIsInView(entry.isIntersecting);
      onChange?.(entry.isIntersecting);
    });

    const wrapperEl = wrapperRef.current;

    if (wrapperEl) {
      LazyLoader.observer.observe(wrapperEl);
    }

    return () => {
      delete LazyLoader.callbacks[id];
      wrapperEl && LazyLoader.observer.unobserve(wrapperEl);
      if (Object.keys(LazyLoader.callbacks).length === 0) {
        LazyLoader.observer.disconnect();
      }
    };
  });

  return (
    <div id={id} ref={wrapperRef} style={{ width, height }}>
      {loaded && (typeof children === 'function' ? children({ isInView }) : children)}
    </div>
  );
}

const callbacks: Record<string, (e: IntersectionObserverEntry) => void> = {};
LazyLoader.callbacks = callbacks;
LazyLoader.addCallback = (id: string, c: (e: IntersectionObserverEntry) => void) => (LazyLoader.callbacks[id] = c);
LazyLoader.observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (LazyLoader.callbacks[entry.target.id]) {
        LazyLoader.callbacks[entry.target.id](entry);
      }
    }
  },
  { rootMargin: '100px' }
);
