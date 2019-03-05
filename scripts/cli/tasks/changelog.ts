import { Task, TaskRunner } from './task';
import axios from 'axios';

const githubGrafanaUrl = 'https://github.com/grafana/grafana';

interface ChangelogOptions {}

const changelogTaskRunner: TaskRunner<ChangelogOptions> = async () => {
  let client = axios.create({
    baseURL: 'https://api.github.com/repos/grafana/grafana',
    timeout: 10000,
  });

  const res = await client.get('/issues?state=closed&labels=' + encodeURIComponent('add to changelog'));
  let markdown = '';

  for (const item of res.data) {
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
