import { execFileSync } from 'node:child_process';

import {
  loadConfig, requireEnv, log, setOutput,
  sanitizeForSlack, isValidGitHubUsername, sendSlackMessage,
  type TeamConfig,
} from './utils.mts';

// =============================================================================
// METADATA
// =============================================================================

function getIssueMetadata(): void {
  const issueNumber = requireEnv('ISSUE_NUMBER');
  const repo = requireEnv('REPO');

  const issueData = JSON.parse(
    execFileSync('gh', ['issue', 'view', issueNumber, '--repo', repo, '--json', 'title,author,labels,createdAt'], {
      encoding: 'utf-8', timeout: 30_000,
    }),
  );

  const labels: string[] = (issueData.labels ?? []).map((l: { name: string }) => l.name);
  if (labels.includes('fr/auto-triaged')) {
    log.notice(`Issue #${issueNumber} already has fr/auto-triaged label - skipping to prevent duplicate processing`);
    setOutput('skip_processing', 'true');
    process.exit(0);
  }
  setOutput('skip_processing', 'false');

  setOutput('created_date', (issueData.createdAt as string).split('T')[0]);

  const title = (issueData.title as string ?? 'No title').replace(/[\x00-\x1F]/g, '').slice(0, 150);
  let author = issueData.author?.login ?? 'unknown';
  if (!isValidGitHubUsername(author)) {
    log.warning('Invalid author format detected, using "unknown"');
    author = 'unknown';
  }
  const allLabels = labels.join(',');
  const areaLabels = labels.filter((l) => l.startsWith('area/')).join(' ');

  setOutput('title_b64', Buffer.from(title).toString('base64'));
  setOutput('author', author);
  setOutput('labels', allLabels);
  setOutput('area_labels', areaLabels);

  console.log('Issue Metadata:');
  console.log(`  Title: ${title}`);
  console.log(`  Author: ${author}`);
  console.log(`  Labels: ${allLabels}`);
  console.log(`  Area Labels: ${areaLabels}`);
}

// =============================================================================
// NOTIFY
// =============================================================================

async function sendNotifications(): Promise<void> {
  const repo = requireEnv('REPO');
  const issueNumber = requireEnv('ISSUE_NUMBER');
  const areaLabels = process.env.AREA_LABELS ?? '';
  const titleB64 = process.env.TITLE_B64 ?? '';
  const rawAuthor = process.env.AUTHOR ?? 'unknown';
  const author = isValidGitHubUsername(rawAuthor) ? rawAuthor : 'unknown';
  const slackBotToken = process.env.SLACK_BOT_TOKEN ?? '';
  const createdDate = process.env.CREATED_DATE ?? '';

  if (!areaLabels) {
    log.notice('No area/* labels found on this FR, skipping team notifications');
    setOutput('notification_sent', 'false');
    return;
  }

  const config = loadConfig();
  const frTitle = sanitizeForSlack(titleB64 ? Buffer.from(titleB64, 'base64').toString('utf-8') : `FR #${issueNumber}`);
  const frUrl = `https://github.com/${repo}/issues/${issueNumber}`;
  const prAreaLabels = areaLabels.split(/\s+/).filter(Boolean);

  let matchedTeams = 0;
  let notificationSent = false;

  for (const team of config.teams) {
    if (!(team.enabled?.fr_notify ?? false)) {
      console.log(`Skipping team ${team.name} (FR notifications disabled)`);
      continue;
    }

    if (createdDate && team.adoption_date && createdDate < team.adoption_date) {
      console.log(`Skipping team ${team.name} (FR created ${createdDate}, before adoption date ${team.adoption_date})`);
      continue;
    }

    const teamLabels = team.area_labels ?? [];
    let matchedLabel = '';
    for (const issueLabel of prAreaLabels) {
      for (const configLabel of teamLabels) {
        if (issueLabel.startsWith(configLabel)) {
          matchedLabel = issueLabel;
          break;
        }
      }
      if (matchedLabel) break;
    }

    if (!matchedLabel) continue;

    const matchedLabelEncoded = matchedLabel.replace(/\//g, '%2F');

    log.groupStart(`Processing team: ${team.name}`);
    console.log(`Matched area label for team ${team.name}: ${matchedLabel}`);
    matchedTeams++;

    const channelId = team.slack_channels?.fr ?? '';
    if (!channelId) {
      log.warning(`No Slack channel ID configured for team ${team.name} (slack_channels.fr)`);
      log.groupEnd();
      continue;
    }
    if (!slackBotToken) {
      log.warning('SLACK_BOT_TOKEN not set, cannot send notification');
      log.groupEnd();
      continue;
    }

    const ok = await sendSlackMessage(slackBotToken, {
      channel: channelId,
      attachments: [{
        color: '#6f42c1',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `✨ New Feature Request: ${team.name}`, emoji: true },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*<${frUrl}|${frTitle}>*\nby @${author}` },
          },
          { type: 'divider' },
          {
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: `🔍 <https://github.com/${repo}/issues?q=is%3Aissue+is%3Aopen+label%3Atype%2Ffeature-request+label%3Afr%2Fauto-triaged+label%3A${matchedLabelEncoded}|View all ${team.name} feature requests>`,
            }],
          },
        ],
      }],
    });

    if (ok) {
      log.notice(`Slack notification sent to ${team.name} (channel: ${channelId})`);
      notificationSent = true;
    } else {
      log.warning(`Slack failed for ${team.name}`);
    }

    log.groupEnd();
  }

  if (matchedTeams === 0) {
    log.notice(`No teams matched for area labels: ${areaLabels}`);
  }

  setOutput('notification_sent', String(notificationSent));
}

// =============================================================================
// WELCOME COMMENT
// =============================================================================

function postWelcomeComment(): void {
  const issueNumber = requireEnv('ISSUE_NUMBER');
  const repo = requireEnv('REPO');

  const comments = execFileSync(
    'gh', ['issue', 'view', issueNumber, '--repo', repo, '--json', 'comments', '--jq', '.comments[].body'],
    { encoding: 'utf-8', timeout: 30_000 },
  );

  if (comments.includes('Thanks for submitting this feature request')) {
    console.log('Welcome comment already exists, skipping...');
    return;
  }

  const body = [
    'Thanks for submitting this feature request!',
    '',
    'A notification has been sent to the relevant team.',
    '',
    '📖 [Tips for writing effective feature requests](https://github.com/grafana/grafana/blob/main/contribute/create-feature-request.md)',
    '',
    'We appreciate your input in making Grafana better!',
  ].join('\n');

  execFileSync('gh', ['issue', 'comment', issueNumber, '--repo', repo, '--body', body], {
    encoding: 'utf-8', timeout: 30_000,
  });
  console.log('Welcome comment posted');
}

// =============================================================================
// AUTO-TRIAGED LABEL
// =============================================================================

function addAutoTriagedLabel(): void {
  const issueNumber = requireEnv('ISSUE_NUMBER');
  const repo = requireEnv('REPO');

  console.log('Adding fr/auto-triaged label to track automated triage');
  execFileSync('gh', ['issue', 'edit', issueNumber, '--repo', repo, '--add-label', 'fr/auto-triaged'], {
    encoding: 'utf-8', timeout: 30_000,
  });
}

// =============================================================================
// MAIN DISPATCH
// =============================================================================

const action = process.argv[2];

switch (action) {
  case 'metadata':
    getIssueMetadata();
    break;
  case 'notify':
    await sendNotifications();
    break;
  case 'welcome':
    postWelcomeComment();
    break;
  case 'auto-triaged':
    addAutoTriagedLabel();
    break;
  default:
    console.error(`Usage: fr-notify.mts {metadata|notify|welcome|auto-triaged}`);
    process.exit(1);
}
