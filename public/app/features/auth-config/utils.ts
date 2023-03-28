import { Settings } from 'app/types';

export function filterAuthSettings(settings: Settings) {
  const authSettings: Settings = {};
  Object.entries(settings)
    .filter(([sectionName, sectionSettings]) => {
      return sectionName === 'auth';
    })
    .forEach(([sectionName, sectionSettings]) => {
      authSettings[sectionName] = sectionSettings;
    });
  return authSettings;
}
