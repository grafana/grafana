import { useEffect, useRef } from 'react';
import { useIntersection } from 'react-use';

type Props = {
  handleLoad: () => void;
};

function LoadMoreHelper({ handleLoad }: Props) {
  const intersectionRef = useRef<HTMLDivElement>(null);
  const intersection = useIntersection(intersectionRef, {
    root: null,
    threshold: 1,
  });

  useEffect(() => {
    const completelyInView = intersection && intersection.intersectionRatio > 0;
    if (completelyInView) {
      handleLoad();
    }
  }, [intersection, handleLoad]);

  return <div ref={intersectionRef} data-testid="load-more-helper" />;
}

export default LoadMoreHelper;
