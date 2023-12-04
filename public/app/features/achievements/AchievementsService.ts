// mix of util / helper functions to save achievement data, and to check if an achievement has been completed

import { AppEvents } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { UserDTO } from 'app/types/user';

import { api } from '../profile/api';

import { achievementLevelThresholds, achievements } from './Achievements';
import { Achievement, AchievementId, AchievementLevel } from './types';

// function to use across Grafana to register an achievement as completed
// needs to look at current user data, see if achievement is already completed, and if not, save it as completed on user object
// also needs to check if the achievement is a level up, and if so, save the new level on the user object
export const registerAchievementCompleted = async (achievementId: AchievementId): Promise<void> => {
  const user = await api.loadUser();

  console.log('user: ', user);

  // check if achievement is already completed
  if (userHasCompletedAchievement(achievementId, user)) {
    return;
  }

  // save achievement as completed on user object
  user.achievements?.push(achievementId);

  // check if achievement is a level up
  // if so, save new level on user object
  const isLevelUp = checkIfLevelUp(user);

  try {
    updateUser(user);
  } catch (err) {
    console.error(err);
    // display error?
  }

  // TODO notify user of achievement completion / level up!
  if (isLevelUp) {
    // TODO notify user of level up!
    console.log('level up! new level: ', user.level);
    appEvents.emit(AppEvents.alertSuccess, ['Level up!', `You are now a level ${user.level} Grafana user!`]);
  } else {
    // TODO notify user of achievement completion!
    console.log('achievement completed!', achievementId);
    appEvents.emit(AppEvents.alertSuccess, [
      'Achievement completed!',
      `You have completed the ${achievementId} achievement!`,
    ]);
  }
};

const checkIfLevelUp = (user: UserDTO): boolean => {
  const currentLevel = user.level ?? 0;
  if (currentLevel === AchievementLevel.Wizard) {
    return false;
  }

  const achievementsCompleted = user.achievements?.length ?? 0;
  const nextThresholdIndex: keyof typeof achievementLevelThresholds = currentLevel + 1;
  const nextLevelThreshold = achievementLevelThresholds[nextThresholdIndex];

  if (achievementsCompleted >= nextLevelThreshold) {
    user.level = currentLevel + 1;
    return true;
  }

  return false;
};

const updateUser = async (user: UserDTO): Promise<void> => {
  await getBackendSrv().put('/api/user', user);
};

// function to check if a user has completed an achievement
export const userHasCompletedAchievement = (achievementId: AchievementId, user: UserDTO): boolean => {
  return user.achievements?.some((achievement) => achievement === achievementId) ?? false;
};

// function to provide all achievements for a user (with completion status)
export const getAchievements = async (): Promise<Achievement[]> => {
  const user = await api.loadUser();
  return achievements.map((achievement) => {
    return {
      ...achievement,
      completed: userHasCompletedAchievement(achievement.id, user),
    };
  });
};

// function to retrieve user level
export const getUserLevel = async (): Promise<number> => {
  const user = await api.loadUser();
  return user.level ?? 0;
};
