// @ts-ignore
import * as _ from 'lodash';
import { Task, TaskRunner } from './task';
import GithubClient from '../utils/githubClient';
import difference from 'lodash/difference';
import chalk from 'chalk';
import { useSpinner } from '../utils/useSpinner';

interface ChangelogOptions {
  milestone: string;
}

const filterBugs = (item: any) => {
  if (item.title.match(/fix|fixes/i)) {
    return true;
  }
  if (item.labels.find((label: any) => label.name === 'type/bug')) {
    return true;
  }
  return false;
};

const getPackageChangelog = (packageName: string, issues: any[]) => {
  if (issues.length === 0) {
    return '';
  }

  let markdown = chalk.bold.yellow(`\n\n/*** ${packageName} changelog  ***/\n\n`);
  const bugs = _.sortBy(issues.filter(filterBugs), 'title');
  const notBugs = _.sortBy(difference(issues, bugs), 'title');

  if (notBugs.length > 0) {
    markdown += '### Features / Enhancements\n';
    for (const item of notBugs) {
      markdown += getMarkdownLineForIssue(item);
    }
  }

  if (bugs.length > 0) {
    markdown += '\n### Bug Fixes\n';
    for (const item of bugs) {
      markdown += getMarkdownLineForIssue(item);
    }
  }

  return markdown;
};

const changelogTaskRunner: TaskRunner<ChangelogOptions> = useSpinner<ChangelogOptions>(
  'Generating changelog',
  async ({ milestone }) => {
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

    const mergedIssues = [];
    for (const item of res.data) {
      if (!item.pull_request) {
        // it's an issue, not pull request
        mergedIssues.push(item);
        continue;
      }
      const isMerged = await client.get(item.pull_request.url + '/merge');
      if (isMerged.status === 204) {
        mergedIssues.push(item);
      }
    }
    const issues = _.sortBy(mergedIssues, 'title');

    const toolkitIssues = issues.filter((item: any) =>
      item.labels.find((label: any) => label.name === 'area/grafana/toolkit')
    );
    const grafanaUiIssues = issues.filter((item: any) =>
      item.labels.find((label: any) => label.name === 'area/grafana/ui')
    );

    let markdown = '';

    markdown += getPackageChangelog('Grafana', issues);
    markdown += getPackageChangelog('grafana-toolkit', toolkitIssues);
    markdown += getPackageChangelog('grafana-ui', grafanaUiIssues);

    console.log(markdown);
  }
);

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
