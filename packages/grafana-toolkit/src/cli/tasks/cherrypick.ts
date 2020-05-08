import { Task, TaskRunner } from './task';
import GithubClient from '../utils/githubClient';

interface CherryPickOptions {
  enterprise: boolean;
}

// https://github.com/lisposter/github-pagination/blob/master/lib/octopage.js
const pagingParser = (linkStr: string): { prev?: string; next?: string; last?: string; first?: string } => {
  return linkStr
    .split(',')
    .map(rel => {
      //@ts-ignore
      return rel.split(';').map((curr, idx) => {
        if (idx === 0) {
          //@ts-ignore
          return /[^_]page=(\d+)/.exec(curr)[1];
        }
        if (idx === 1) {
          //@ts-ignore
          return /rel="(.+)"/.exec(curr)[1];
        }
      });
    })
    .reduce(function(obj, curr, i) {
      //@ts-ignore
      obj[curr[1]] = curr[0];
      return obj;
    }, {});
};

const getIssues = async (client: any, page: string) => {
  const result = await client.get('/issues', {
    params: {
      state: 'closed',
      per_page: 100,
      labels: 'cherry-pick needed',
      sort: 'closed',
      direction: 'asc',
      page,
    },
  });

  let data = result.data;
  if (!result.headers.link) {
    return data;
  }

  const pages = pagingParser(result.headers.link);

  if (pages.next) {
    const nextPage = await getIssues(client, pages.next);
    data = data.concat(nextPage);
  }
  return data;
};

const cherryPickRunner: TaskRunner<CherryPickOptions> = async ({ enterprise }) => {
  const githubClient = new GithubClient({ enterprise });
  const client = githubClient.client;
  const results = await getIssues(client, '1');

  // sort by closed date ASC
  results.sort((a: any, b: any) => {
    return new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime();
  });

  let commands = '';

  console.log('--------------------------------------------------------------------');
  console.log('Printing PRs with cherry-pick-needed, in ASC merge date order');
  console.log('--------------------------------------------------------------------');

  for (const item of results) {
    if (!item.milestone) {
      console.log(item.number + ' missing milestone!');
      continue;
    }
    const issueDetails = await client.get(item.pull_request.url);

    if (!issueDetails.data.merged) {
      continue;
    }

    console.log(`* ${item.title}, (#${item.number}), merge-sha: ${issueDetails.data.merge_commit_sha}`);
    commands += `git cherry-pick -x ${issueDetails.data.merge_commit_sha}\n`;
  }

  console.log('--------------------------------------------------------------------');
  console.log('Commands (in order of how they should be executed)');
  console.log('--------------------------------------------------------------------');
  console.log(commands);
};

export const cherryPickTask = new Task<CherryPickOptions>('Cherry pick task', cherryPickRunner);
