import { RepoType } from '../Wizard/types';

export function isFileHistorySupported(repoType?: string) {
  const supportedRepoTypes: RepoType[] = ['github', 'gitlab', 'bitbucket'];
  return repoType && repoType in supportedRepoTypes;
}
