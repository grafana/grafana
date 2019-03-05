import { Task, TaskRunner } from './task';
import axios from 'axios';
import issueRegex from 'issue-regex';

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
    markdown += '* ' + item.title;
    markdown += ` [#${item.number}](${githubGrafanaUrl}/issues/${item.number})`;

    for (const issue of item.body.match(issueRegex())) {
      markdown += ` [#${issue}](${githubGrafanaUrl}/issues/${issue})`;
    }

    markdown += '\n';
  }

  console.log(markdown);
};

export const changelogTask = new Task<ChangelogOptions>();
changelogTask.setName('Changelog generator task');
changelogTask.setRunner(changelogTaskRunner);
