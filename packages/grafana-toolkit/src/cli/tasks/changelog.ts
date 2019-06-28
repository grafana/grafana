import axios from 'axios';
// @ts-ignore
import * as _ from 'lodash';
import { Task, TaskRunner } from './task';
import GithubClient from '../utils/githubClient';

interface ChangelogOptions {
  milestone: string;
}

const changelogTaskRunner: TaskRunner<ChangelogOptions> = async ({ milestone }) => {
  const githubClient = new GithubClient();
  const client = githubClient.client;

  if (!/^\d+$/.test(milestone)) {
    console.log('Use milestone number not title, find number in milestone url');
    return;
  }

  const res = await client.get('/issues', {
    params: {
      state: 'closed',
      per_page: 100,
      labels: 'add to changelog',
      milestone: milestone,
    },
  });

  const issues = res.data;

  const bugs = _.sortBy(
    issues.filter((item: any) => {
      if (item.title.match(/fix|fixes/i)) {
        return true;
      }
      if (item.labels.find((label: any) => label.name === 'type/bug')) {
        return true;
      }
      return false;
    }),
    'title'
  );

  const notBugs = _.sortBy(issues.filter((item: any) => !bugs.find((bug: any) => bug === item)), 'title');

  let markdown = '';

  if (notBugs.length > 0) {
    markdown = '### Features / Enhancements\n';
  }

  for (const item of notBugs) {
    markdown += getMarkdownLineForIssue(item);
  }

  if (bugs.length > 0) {
    markdown += '\n### Bug Fixes\n';
  }

  for (const item of bugs) {
    markdown += getMarkdownLineForIssue(item);
  }

  console.log(markdown);
};

function getMarkdownLineForIssue(item: any) {
  const githubGrafanaUrl = 'https://github.com/grafana/grafana';
  let markdown = '';
  const title = item.title.replace(/^([^:]*)/, (_match: any, g1: any) => {
    return `**${g1}**`;
  });

  markdown += '* ' + title + '.';
  markdown += ` [#${item.number}](${githubGrafanaUrl}/pull/${item.number})`;
  markdown += `, [@${item.user.login}](${item.user.html_url})`;

  markdown += '\n';

  return markdown;
}

export const changelogTask = new Task<ChangelogOptions>('Changelog generator task', changelogTaskRunner);
