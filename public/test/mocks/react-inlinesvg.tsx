import { Ref, useEffect } from 'react';

export default function ReactInlineSVG({
  src,
  innerRef,
  cacheRequests,
  preProcessor,
  onLoad,
  ...rest
}: {
  src: string;
  innerRef: Ref<SVGSVGElement>;
  cacheRequests: boolean;
  preProcessor: () => string;
  onLoad?: () => void;
}) {
  // Simulate async loading behavior
  useEffect(() => {
    if (onLoad) {
      // Call onLoad synchronously in tests to avoid timing issues
      onLoad();
    }
  }, [src, onLoad]);

  return <svg id={src} ref={innerRef} {...rest} />;
}

export const cacheStore = {};
