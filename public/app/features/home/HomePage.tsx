import { useEffect, useRef } from 'react';

import { HomeGoals } from './HomeGoals';
import { homepageViewed } from './analytics/main';

export default function HomePage() {
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      homepageViewed();
    }
  }, []);

  return <HomeGoals />;
}
