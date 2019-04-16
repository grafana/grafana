import axios from 'axios';
import _ from 'lodash';
import { Task, TaskRunner } from './task';

const githubGrafanaUrl = 'https://github.com/grafana/grafana';

interface ChangelogOptions {
  milestone: string;
}

const changelogTaskRunner: TaskRunner<ChangelogOptions> = async ({ milestone }) => {
  const client = axios.create({
    baseURL: 'https://api.github.com/repos/grafana/grafana',
    timeout: 10000,
  });

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
    issues.filter(item => {
      if (item.title.match(/fix|fixes/i)) {
        return true;
      }
      if (item.labels.find(label => label.name === 'type/bug')) {
        return true;
      }
      return false;
    }),
    'title'
  );

  const notBugs = _.sortBy(issues.filter(item => !bugs.find(bug => bug === item)), 'title');

  let markdown = '### Features / Enhancements\n';

  for (const item of notBugs) {
    markdown += getMarkdownLineForIssue(item);
  }

  markdown += '\n### Bug Fixes\n';
  for (const item of bugs) {
    markdown += getMarkdownLineForIssue(item);
  }

  console.log(markdown);
};

function getMarkdownLineForIssue(item: any) {
  let markdown = '';
  const title = item.title.replace(/^([^:]*)/, (match, g1) => {
    return `**${g1}**`;
  });

  markdown += '* ' + title + '.';
  markdown += ` [#${item.number}](${githubGrafanaUrl}/pull/${item.number})`;
  markdown += `, [@${item.user.login}](${item.user.html_url})`;

  markdown += '\n';

  return markdown;
}

export const changelogTask = new Task<ChangelogOptions>();
changelogTask.setName('Changelog generator task');
changelogTask.setRunner(changelogTaskRunner);
