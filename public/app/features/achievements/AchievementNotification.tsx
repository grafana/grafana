import React from 'react';

type AchievementNotificationProps = {
  title: string;
};

export const AchievementNotification = ({ title }: AchievementNotificationProps) => {
  return (
    <a href="/profile/achievements">
      <h3>Achievement Unlocked!</h3>
      <h5>{title}</h5>
    </a>
  );
};
