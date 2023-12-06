import { useAsync } from 'react-use';

import { getAchievements } from './AchievementsService';

export const useAchievements = () => {
  const state = useAsync(async () => {
    return await getAchievements();
  });

  return {
    ...state,
    achievementsList: state.value,
  };
};
