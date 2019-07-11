import { Task, TaskRunner } from './task';
import GithubClient from '../utils/githubClient';

interface CloseMilestoneOptions {
  milestone: string;
}

const closeMilestoneTaskRunner: TaskRunner<CloseMilestoneOptions> = async ({ milestone }) => {
  const githubClient = new GithubClient(true);

  const cherryPickLabel = 'cherry-pick needed';
  const client = githubClient.client;

  if (!/^\d+$/.test(milestone)) {
    console.log('Use milestone number not title, find number in milestone url');
    return;
  }

  const milestoneRes = await client.get(`/milestones/${milestone}`, {});

  const milestoneState = milestoneRes.data.state;

  if (milestoneState === 'closed') {
    console.log('milestone already closed. ✅');
    return;
  }

  console.log('fetching issues/PRs of the milestone ⏬');

  // Get all the issues/PRs with the label cherry-pick
  // Every pull request is actually an issue
  const issuesRes = await client.get('/issues', {
    params: {
      state: 'closed',
      labels: cherryPickLabel,
      per_page: 100,
      milestone: milestone,
    },
  });

  if (issuesRes.data.length < 1) {
    console.log('no issues to remove label from');
  } else {
    console.log(`found ${issuesRes.data.length} issues to remove the cherry-pick label from 🔎`);
  }

  for (const issue of issuesRes.data) {
    // the reason for using stdout.write is for achieving 'action -> result' on
    // the same line
    process.stdout.write(`🔧removing label from issue #${issue.number} 🗑...`);
    const resDelete = await client.delete(`/issues/${issue.number}/labels/${cherryPickLabel}`, {});
    if (resDelete.status === 200) {
      process.stdout.write('done ✅\n');
    } else {
      console.log('failed ❌');
    }
  }

  console.log(`cleaned up ${issuesRes.data.length} issues/prs ⚡️`);

  const resClose = await client.patch(`/milestones/${milestone}`, {
    state: 'closed',
  });

  if (resClose.status === 200) {
    console.log('milestone closed 🙌');
  } else {
    console.log('failed to close the milestone, response:');
    console.log(resClose);
  }
};

export const closeMilestoneTask = new Task<CloseMilestoneOptions>(
  'Close Milestone generator task',
  closeMilestoneTaskRunner
);
