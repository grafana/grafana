import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';

const getHomeGreeting = (name?: string) => {
  const time = new Date();
  const hours = time.getHours();

  if (name) {
    if (hours >= 5 && hours <= 11) {
      return t('home.home-page.greeting.morning-name', 'Good morning, {{name}}', { name });
    } else if (hours >= 12 && hours <= 17) {
      return t('home.home-page.greeting.afternoon-name', 'Good afternoon, {{name}}', { name });
    }
    return t('home.home-page.greeting.evening-name', 'Good evening, {{name}}', { name });
  }

  if (hours >= 5 && hours <= 11) {
    return t('home.home-page.greeting.morning', 'Good morning.');
  } else if (hours >= 12 && hours <= 17) {
    return t('home.home-page.greeting.afternoon', 'Good afternoon.');
  } else {
    return t('home.home-page.greeting.evening', 'Good evening.');
  }
};

/** The time-of-day greeting; with a `name`, it greets that person. */
const useHomeGreeting = (name?: string) => {
  // Re-renders hourly so the time of day catches up; the greeting itself is read on each render.
  const [, setHour] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setHour((hour) => hour + 1), 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  return getHomeGreeting(name);
};

export default useHomeGreeting;
