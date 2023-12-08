import React from 'react';

import { AchievementCard } from './AchievementCard';
import { AchievementLevel } from './types';

export const achievementsByName = ['Newcomer', 'Novice', 'Beginner', 'Experienced', 'Expert', 'Wizard'];

export const AchievementsList = () => {
  return (
    <>
      {achievementsByName.map((achievement, index) => {
        if (index === 0) {
          return null;
        }
        return (
          <AchievementCard
            key={index}
            title={achievement}
            level={AchievementLevel[achievement as keyof typeof AchievementLevel]}
          />
        );
      })}
    </>
  );
};
