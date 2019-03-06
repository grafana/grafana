import { Task, TaskRunner } from './task';
import axios from 'axios';

const githubGrafanaUrl = 'https://github.com/grafana/grafana';

interface ChangelogOptions {
  milestone: string;
}

const changelogTaskRunner: TaskRunner<ChangelogOptions> = async ({ milestone }) => {
  let client = axios.create({
    baseURL: 'https://api.github.com/repos/grafana/grafana',
    timeout: 10000,
  });

  const res = await client.get('/issues', {
    params: {
      state: 'closed',
      labels: 'add to changelog',
    },
  });

  let markdown = '';

  for (const item of res.data) {
    if (!item.milestone) {
      console.log('Item missing milestone', item.number);
      continue;
    }

    // For some reason I could not get the github api to filter on milestone and label
    // So doing this filter here
    if (item.milestone.title !== milestone) {
      continue;
    }

    markdown += '* ' + item.title + '.';
    markdown += ` [#${item.number}](${githubGrafanaUrl}/pull/${item.number})`;
    markdown += `, [@${item.user.login}](${item.user.html_url})`;

    markdown += '\n';
  }

  console.log(markdown);
};

export const changelogTask = new Task<ChangelogOptions>();
changelogTask.setName('Changelog generator task');
changelogTask.setRunner(changelogTaskRunner);
