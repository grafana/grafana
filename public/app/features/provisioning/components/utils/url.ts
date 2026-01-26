// repoType = string because this repoType is coming from URL param
export const getBranchUrl = (baseUrl: string, branch: string, repoType?: string): string => {
  if (repoType === 'local') {
    return '';
  }

  switch (repoType) {
    case 'github':
      return `${baseUrl}/tree/${branch}`;
    case 'gitlab':
      return `${baseUrl}/-/tree/${branch}`;
    case 'bitbucket':
      return `${baseUrl}/src/${branch}`;
    default:
      return '';
  }
};
