import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { AchievementsList } from './AchievementsList';
import { AchievementsProgress } from './AchievementsProgress';

export const AchievementsPage = () => {
  return (
    <Page navId="profile/achievements">
      <Page.Contents>
        <AchievementsProgress />
        <AchievementsList />
      </Page.Contents>
    </Page>
  );
};

export default AchievementsPage;
