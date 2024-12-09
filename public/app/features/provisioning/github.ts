import { Octokit } from 'octokit';
import { createPullRequest } from 'octokit-plugin-create-pull-request';

import { Resource } from '../apiserver/types';

import { RepositorySpec } from './api/types';

interface PullRequestData {
  title: string;
  comment: string;
  branch: string;
  path: string;
  body: object;
}

export async function createGithubPullRequest(repo: Resource<RepositorySpec>, data: PullRequestData) {
  const spec = repo.spec.github;
  if (!spec?.owner || !spec.repository) {
    return Promise.reject('Repository not configured');
  }

  const MyOctokit = Octokit.plugin(createPullRequest);
  const client = new MyOctokit({
    // TODO!!! can we use oauth web flow?
    auth: spec.token,
  });
  return client
    .createPullRequest({
      owner: spec.owner,
      repo: spec.repository,
      title: data.title,
      body: data.comment,
      head: data.branch, // New name?
      base: spec.branch ?? 'main', // optional: defaults to default branch
      update: false, // optional: set to `true` to enable updating existing pull requests
      forceFork: false, // optional: force creating fork even when user has write rights
      labels: ['grafana'],
      changes: [
        {
          commit: data.comment, // same as PR description (for now?)
          files: {
            // TODO??? Need to know what format???
            [data.path]: JSON.stringify(data.body, null, '  '),
          },
          /* optional: if not passed, will be the authenticated user and the current date */
          author: {
            name: 'Author LastName',
            email: 'Author.LastName@acme.com', 
            date: new Date().toISOString(), // must be ISO date string
          },
          // signature: async function (commitPayload) {
          //   // import { createSignature } from 'github-api-signature'
          //   //
          //   // return createSignature(
          //   //   commitPayload,
          //   //   privateKey,
          //   //   passphrase
          //   // );
          // },
        },
      ],
    })
    .then((pr) => {
      console.log('PR', pr);
      return `Created PR: ${pr?.data?.number}`;
    });
}
