import React from 'react';

import { AchievementCard } from './AchievementCard';
import { AchievementLevel } from './types';

const achievementsByName = ['Novice', 'Beginner', 'Experienced', 'Expert', 'Wizard'];

export const AchievementsList = () => {
  return (
    <>
      {achievementsByName.map((achievement, index) => {
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
