import { Ref } from 'react';

export default function ReactInlineSVG({
  src,
  innerRef,
  cacheRequests,
  preProcessor,
  ...rest
}: {
  src: string;
  innerRef: Ref<SVGSVGElement>;
  cacheRequests: boolean;
  preProcessor: () => string;
}) {
  return <svg id={src} ref={innerRef} {...rest} />;
}

export const cacheStore = {};
