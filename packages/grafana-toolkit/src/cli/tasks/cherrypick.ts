import { Task, TaskRunner } from './task';
import GithubClient from '../utils/githubClient';

interface CherryPickOptions {}

const cherryPickRunner: TaskRunner<CherryPickOptions> = async () => {
  const githubClient = new GithubClient();
  const client = githubClient.client;

  const res = await client.get('/issues', {
    params: {
      state: 'closed',
      labels: 'cherry-pick needed',
    },
  });

  // sort by closed date ASC
  res.data.sort((a: any, b: any) => {
    return new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime();
  });

  let commands = '';

  console.log('--------------------------------------------------------------------');
  console.log('Printing PRs with cherry-pick-needed, in ASC merge date order');
  console.log('--------------------------------------------------------------------');

  for (const item of res.data) {
    if (!item.milestone) {
      console.log(item.number + ' missing milestone!');
      continue;
    }

    const issueDetails = await client.get(item.pull_request.url);
    console.log(`* ${item.title}, (#${item.number}), merge-sha: ${issueDetails.data.merge_commit_sha}`);
    commands += `git cherry-pick -x ${issueDetails.data.merge_commit_sha}\n`;
  }

  console.log('--------------------------------------------------------------------');
  console.log('Commands (in order of how they should be executed)');
  console.log('--------------------------------------------------------------------');
  console.log(commands);
};

export const cherryPickTask = new Task<CherryPickOptions>('Cherry pick task', cherryPickRunner);
