import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';

const getHomeGreeting = () => {
  const time = new Date();
  const hours = time.getHours();

  if (hours >= 5 && hours <= 11) {
    return t('home.home-page.greeting.morning', 'Good morning.');
  } else if (hours >= 12 && hours <= 17) {
    return t('home.home-page.greeting.afternoon', 'Good afternoon.');
  } else {
    return t('home.home-page.greeting.evening', 'Good evening.');
  }
};

const useHomeGreeting = () => {
  const [greeting, setGreeting] = useState(() => getHomeGreeting());

  useEffect(() => {
    const interval = setInterval(() => setGreeting(getHomeGreeting()), 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  return greeting;
};

export default useHomeGreeting;
