import { Settings } from 'app/types';

export function filterAuthSettings(settings: Settings) {
  const authSettings: Settings = Object.fromEntries(
    Object.entries(settings).filter(([sectionName]) => sectionName === 'auth')
  );
  return authSettings;
}
