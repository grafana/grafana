import { RepositorySpec } from '../api';
import { RepositoryFormData } from '../types';

const extractRepoInfo = (url: string): { owner: string; repository: string } => {
  try {
    // First try parsing as a URL
    const urlObj = new URL(url);
    if (urlObj.hostname === 'github.com') {
      const [owner, repository] = urlObj.pathname.split('/').filter(Boolean);
      return { owner, repository };
    }
  } catch (e) {
    // If URL parsing fails, try as owner/repo format
    if (url.match(/^[^/]+\/[^/]+$/)) {
      const [owner, repository] = url.split('/');
      return { owner, repository };
    }
  }
  return { owner: '', repository: '' };
};

export const dataToSpec = (data: RepositoryFormData): RepositorySpec => {
  const spec: RepositorySpec = {
    type: data.type,
    sync: data.sync,
    title: data.title || '',
    readOnly: data.readOnly,
  };
  switch (data.type) {
    case 'github':
      const { owner, repository } = extractRepoInfo(data.repositoryUrl || '');
      spec.github = {
        workflows: data.workflows,
        generateDashboardPreviews: data.generateDashboardPreviews,
        owner: owner || '',
        repository: repository || '',
        branch: data.branch,
        token: data.token,
      };
      break;
    case 'local':
      spec.local = {
        path: data.path,
      };
      break;
    case 's3':
      spec.s3 = {
        bucket: data.bucket,
        region: data.region,
      };
      break;
  }

  return spec;
};

export const specToData = (spec: RepositorySpec): RepositoryFormData => {
  const owner = spec?.github?.owner || '';
  const repository = spec?.github?.repository || '';
  const repositoryUrl = owner && repository ? `https://github.com/${owner}/${repository}` : '';
  
  return {
    ...spec,
    repositoryUrl,
    ...spec.github,
    ...spec.local,
    ...spec.s3,
  };
};
