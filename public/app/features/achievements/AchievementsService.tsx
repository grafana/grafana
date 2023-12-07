// mix of util / helper functions to save achievement data, and to check if an achievement has been completed

import React from 'react';
import toast from 'react-hot-toast';

import { AppEvents } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { UserDTO } from 'app/types/user';

import { api } from '../profile/api';

import { AchievementNotification } from './AchievementNotification';
import { achievementLevelThresholds, achievements } from './Achievements';
import { LevelUpNotification } from './LevelUpNotification';
import { Achievement, AchievementId, AchievementLevel } from './types';

// function to use across Grafana to register an achievement as completed
// needs to look at current user data, see if achievement is already completed, and if not, save it as completed on user object
// also needs to check if the achievement is a level up, and if so, save the new level on the user object
export const registerAchievementCompleted = async (achievementId: AchievementId): Promise<void> => {
  const user = await api.loadUser();

  // check if achievement is already completed
  if (userHasCompletedAchievement(achievementId, user)) {
    console.log('achievement already done');
    return;
  }

  // save achievement as completed on user object
  const userAchievements = parseAchievementString(user.achievements);
  userAchievements.push(achievementId);
  user.achievements = JSON.stringify(userAchievements);

  // check if achievement is a level up
  // if so, save new level on user object
  const isLevelUp = checkIfLevelUp(user);

  try {
    updateUser(user);
  } catch (err) {
    console.error(err);
    // display error?
  }

  // bool to check if grafana theme is light or dark
  const isDarkTheme = $('body').hasClass('theme-dark');

  const achievementTitle = achievements.find((achievement) => achievement.id === achievementId)?.title;
  // notify user of achievement completion / level up!
  // TODO: always show achievement completed, after delay show level up if applicable
  if (isLevelUp) {
    setTimeout(() => {
      toast((t) => <LevelUpNotification title={achievementTitle ?? ''} level={user.level ?? 0} toaster={t} />, {
        style: {
          borderRadius: '64px',
          background: isDarkTheme ? '#333' : '#fff',
          color: isDarkTheme ? '#fff' : '#333',
          border: '1px solid #FF9900',
        },
        duration: 30000,
        position: 'top-center',
      });
    }, 5000);
  }

  toast((t) => <AchievementNotification title={achievementTitle ?? ''} level={user.level ?? 0} />, {
    style: {
      borderRadius: '64px',
      background: isDarkTheme ? '#333' : '#fff',
      color: isDarkTheme ? '#fff' : '#333',
      border: '2px solid #FF9900',
    },
    duration: 5000,
  });
};

const checkIfLevelUp = (user: UserDTO): boolean => {
  // User level of -1 or undefined are the same as 0
  const currentLevel = user.level && user.level > 0 ? user.level : 0;
  if (currentLevel === AchievementLevel.Wizard) {
    return false;
  }
  const achievements = parseAchievementString(user.achievements);
  const achievementsCompleted = achievements.length ?? 0;
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

export const resetUser = async (): Promise<void> => {
  const user = await api.loadUser();
  user.level = -1; // setting this to 0 or undefined doesn't update the database
  user.achievements = '[]';
  try {
    updateUser(user);
  } catch (err) {
    console.error(err);
    // display error?
  }
  console.log('User achievements reset!');
  appEvents.emit(AppEvents.alertSuccess, ['User achievements reset!']);
};

// function to check if a user has completed an achievement
export const userHasCompletedAchievement = (achievementId: AchievementId, user: UserDTO): boolean => {
  const achievements = parseAchievementString(user.achievements);
  return achievements?.some((id: string) => id === achievementId) ?? false;
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

const parseAchievementString = (achievementString: string | undefined): string[] => {
  return !achievementString || achievementString === '' ? [] : JSON.parse(achievementString) ?? [];
};
