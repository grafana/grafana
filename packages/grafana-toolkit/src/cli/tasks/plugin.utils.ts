import { readFileSync } from 'fs';

export const getToolkitVersion = () => {
  const pkg = readFileSync(`${__dirname}/../../../package.json`, 'utf8');
  const { version } = JSON.parse(pkg);
  if (!version) {
    throw `Could not find the toolkit version`;
  }
  return version;
};
