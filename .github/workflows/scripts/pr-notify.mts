import { execFileSync } from 'node:child_process';

import {
  loadConfig, requireEnv, log, setOutput,
  sanitizeForSlack, isValidGitHubUsername, globToRegex,
  sendSlackMessage, callOpenAI,
  type TeamConfig,
} from './utils.mts';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_TITLE_LENGTH = 150;
const MAX_FILES_DISPLAY = 5;

// =============================================================================
// METADATA
// =============================================================================

function getPrMetadata(): void {
  const prNumber = requireEnv('PR_NUMBER');
  const repo = requireEnv('REPO');

  const prData = JSON.parse(
    execFileSync('gh', [
      'pr', 'view', prNumber, '--repo', repo,
      '--json', 'additions,deletions,files,title,author,labels,createdAt',
    ], { encoding: 'utf-8', timeout: 30_000 }),
  );

  const labels: string[] = (prData.labels ?? []).map((l: { name: string }) => l.name);
  if (labels.includes('pr/auto-triaged')) {
    log.notice(`PR #${prNumber} already has pr/auto-triaged label - skipping to prevent duplicate processing`);
    setOutput('skip_processing', 'true');
    process.exit(0);
  }
  setOutput('skip_processing', 'false');

  const createdDate = (prData.createdAt as string).split('T')[0];
  setOutput('created_date', createdDate);

  const files: string[] = (prData.files ?? []).map((f: { path: string }) => f.path);
  console.log('Files changed in PR:');
  files.forEach((f) => console.log(f));

  const allLabels = labels.join(',');
  const areaLabels = labels.filter((l) => l.startsWith('area/')).join(' ');
  console.log(`All labels: ${allLabels}`);
  console.log(`Area labels: ${areaLabels}`);

  setOutput('area_labels', areaLabels);
  setOutput('all_labels', allLabels);

  if (!areaLabels) {
    log.warning('No area/* labels found on this PR. Waiting for auto-triager to add labels.');
    setOutput('has_area_labels', 'false');
  } else {
    setOutput('has_area_labels', 'true');
  }

  const additions = prData.additions as number ?? 0;
  const deletions = prData.deletions as number ?? 0;
  const total = additions + deletions;
  const size = total < 50 ? 'small' : total < 300 ? 'medium' : 'large';

  const title = ((prData.title as string) ?? 'No title').replace(/[\x00-\x1F]/g, '').slice(0, MAX_TITLE_LENGTH);
  let author = prData.author?.login ?? 'unknown';
  if (!isValidGitHubUsername(author)) {
    log.warning('Invalid author format detected, using "unknown"');
    author = 'unknown';
  }

  const filesDisplay = files.slice(0, MAX_FILES_DISPLAY).map((f) => `• ${f}`).join('|');

  setOutput('size', size);
  setOutput('additions', String(additions));
  setOutput('deletions', String(deletions));
  setOutput('author', author);
  setOutput('title_b64', Buffer.from(title).toString('base64'));
  setOutput('files_b64', Buffer.from(filesDisplay).toString('base64'));
  setOutput('all_files_b64', Buffer.from(files.join('\n')).toString('base64'));

  console.log('PR Metadata:');
  console.log(`  Title: ${title}`);
  console.log(`  Author: ${author}`);
  console.log(`  Size: ${size} (+${additions}/-${deletions})`);
  console.log(`  Area labels: ${areaLabels}`);
  console.log(`  Files count: ${files.length}`);
}

// =============================================================================
// CHECK TEAMS
// =============================================================================

function checkEnabledTeams(): void {
  const prNumber = requireEnv('PR_NUMBER');
  const repo = requireEnv('REPO');
  const createdDate = process.env.CREATED_DATE ?? '';

  const prData = JSON.parse(
    execFileSync('gh', ['pr', 'view', prNumber, '--repo', repo, '--json', 'files,labels'], {
      encoding: 'utf-8', timeout: 30_000,
    }),
  );

  const files: string[] = (prData.files ?? []).map((f: { path: string }) => f.path);
  const prLabels: string[] = (prData.labels ?? []).map((l: { name: string }) => l.name);
  const areaLabels = prLabels.filter((l) => l.startsWith('area/'));

  console.log(`Files: ${files.length} changed`);
  console.log(`Area labels: ${areaLabels.length > 0 ? areaLabels.join(' ') : 'none'}`);

  const config = loadConfig();
  const matchedTeams: string[] = [];

  if (areaLabels.length === 0) {
    console.log('No area labels on PR, using file pattern routing only');
  }

  for (const team of config.teams) {
    if (!(team.enabled?.pr_notify ?? false)) continue;

    if (createdDate && team.adoption_date && createdDate < team.adoption_date) {
      console.log(`Skipping team ${team.name} (PR created ${createdDate}, before adoption date ${team.adoption_date})`);
      continue;
    }

    let teamMatched = false;

    if (team.file_patterns?.length) {
      for (const pattern of team.file_patterns) {
        const regex = globToRegex(pattern);
        if (files.some((f) => regex.test(f))) {
          console.log(`✅ Team '${team.name}' matches via file pattern: ${pattern}`);
          teamMatched = true;
          break;
        }
      }
    }

    if (!teamMatched && areaLabels.length > 0) {
      const teamLabels = team.area_labels ?? [];
      for (const prLabel of areaLabels) {
        for (const configLabel of teamLabels) {
          if (prLabel.startsWith(configLabel)) {
            console.log(`✅ Team '${team.name}' matches via area label: ${prLabel}`);
            teamMatched = true;
            break;
          }
        }
        if (teamMatched) break;
      }
    }

    if (teamMatched) matchedTeams.push(team.name);
  }

  if (matchedTeams.length > 0) {
    setOutput('has_enabled_team', 'true');
    log.notice(`Matched ${matchedTeams.length} team(s): ${matchedTeams.join(', ')} - proceeding with classification`);
  } else {
    setOutput('has_enabled_team', 'false');
    log.notice('No enabled team matches this PR - skipping classification and notification');
  }
}

// =============================================================================
// CLASSIFY
// =============================================================================

async function classifyPrType(): Promise<void> {
  const prNumber = requireEnv('PR_NUMBER');
  const repo = requireEnv('REPO');
  const openaiApiKey = process.env.OPENAI_API_KEY ?? '';

  if (!openaiApiKey) {
    console.log("OpenAI API key not available, defaulting to 'feature'");
    setOutput('type', 'feature');
    return;
  }

  const prData = JSON.parse(
    execFileSync('gh', ['pr', 'view', prNumber, '--repo', repo, '--json', 'title,files'], {
      encoding: 'utf-8', timeout: 30_000,
    }),
  );

  const title = ((prData.title as string) ?? '').replace(/[\x00-\x1F]/g, '').slice(0, 200);
  const files = (prData.files ?? []).map((f: { path: string }) => f.path).slice(0, 10).join(', ');

  const content = await callOpenAI(openaiApiKey, [
    { role: 'system', content: 'Classify GitHub PRs. Output ONLY one word: docs, bugfix, or feature. Nothing else.' },
    { role: 'user', content: `Classify: Title: ${title}. Files: ${files}` },
  ], { maxTokens: 10, temperature: 0.1 });

  const aiType = content.trim().toLowerCase();
  const type = ['docs', 'bugfix', 'feature'].includes(aiType) ? aiType : 'feature';

  setOutput('type', type);
  console.log(`Classified PR type: ${type}`);
}

// =============================================================================
// LABELS
// =============================================================================

function addClassificationLabels(): void {
  const prNumber = requireEnv('PR_NUMBER');
  const repo = requireEnv('REPO');
  const prType = requireEnv('PR_TYPE');
  const prSize = requireEnv('PR_SIZE');

  const typeLabel = prType === 'docs' ? 'type/docs' : prType === 'bugfix' ? 'type/bug' : 'type/feature';
  const sizeLabel = prSize === 'small' ? 'effort/small' : prSize === 'medium' ? 'effort/medium' : 'effort/large';

  console.log(`Adding labels: ${typeLabel}, ${sizeLabel}`);
  execFileSync('gh', ['pr', 'edit', prNumber, '--repo', repo, '--add-label', typeLabel, '--add-label', sizeLabel], {
    encoding: 'utf-8', timeout: 30_000,
  });
}

// =============================================================================
// NOTIFY
// =============================================================================

async function sendNotifications(): Promise<void> {
  const prNumber = requireEnv('PR_NUMBER');
  const repo = requireEnv('REPO');
  const slackBotToken = process.env.SLACK_BOT_TOKEN ?? '';
  const areaLabelsStr = process.env.AREA_LABELS ?? '';
  const allFilesB64 = process.env.ALL_FILES_B64 ?? '';
  const prSize = process.env.PR_SIZE ?? 'medium';
  const prType = process.env.PR_TYPE ?? 'feature';
  const prAdditions = /^\d+$/.test(process.env.PR_ADDITIONS ?? '') ? process.env.PR_ADDITIONS! : '0';
  const prDeletions = /^\d+$/.test(process.env.PR_DELETIONS ?? '') ? process.env.PR_DELETIONS! : '0';
  const rawAuthor = process.env.PR_AUTHOR ?? 'unknown';
  const prAuthor = isValidGitHubUsername(rawAuthor) ? rawAuthor : 'unknown';
  const titleB64 = process.env.TITLE_B64 ?? '';
  const filesB64 = process.env.FILES_B64 ?? '';
  const createdDate = process.env.CREATED_DATE ?? '';

  const comments = execFileSync(
    'gh', ['pr', 'view', prNumber, '--repo', repo, '--json', 'comments', '--jq', '.comments[].body'],
    { encoding: 'utf-8', timeout: 30_000 },
  );
  if (comments.includes('Thanks for your contribution')) {
    console.log('Already notified for this PR, skipping...');
    return;
  }

  const config = loadConfig();
  const prTitle = sanitizeForSlack(titleB64 ? Buffer.from(titleB64, 'base64').toString('utf-8') : `PR #${prNumber}`);
  const prFiles = filesB64 ? sanitizeForSlack(Buffer.from(filesB64, 'base64').toString('utf-8').replace(/\|/g, '\n')) : '';
  const prUrl = `https://github.com/${repo}/pull/${prNumber}`;
  const allPrFiles = allFilesB64 ? Buffer.from(allFilesB64, 'base64').toString('utf-8').split('\n').filter(Boolean) : [];
  const areaLabels = areaLabelsStr.split(/\s+/).filter(Boolean);

  const emoji = prType === 'docs' ? '📝' : prType === 'bugfix' ? '🐛' : '✨';
  const color = prSize === 'small' ? '#36a64f' : prSize === 'medium' ? '#ff9800' : prSize === 'large' ? '#f44336' : '#808080';

  let matchedTeamCount = 0;
  const matchedTeamNames: string[] = [];
  let notificationSent = false;

  if (areaLabels.length === 0) {
    console.log('No area labels on PR, using file pattern routing only');
  }

  for (const team of config.teams) {
    if (!(team.enabled?.pr_notify ?? false)) {
      console.log(`Skipping team ${team.name} (PR notifications disabled)`);
      continue;
    }

    if (createdDate && team.adoption_date && createdDate < team.adoption_date) {
      console.log(`Skipping team ${team.name} (PR created ${createdDate}, before adoption date ${team.adoption_date})`);
      continue;
    }

    let matchFound = false;
    let matchReason = '';

    if (team.file_patterns?.length && allPrFiles.length > 0) {
      for (const pattern of team.file_patterns) {
        const regex = globToRegex(pattern);
        const matched = allPrFiles.find((f) => regex.test(f));
        if (matched) {
          matchFound = true;
          matchReason = `file pattern: ${pattern} (matched: ${matched})`;
          break;
        }
      }
    }

    if (!matchFound && areaLabels.length > 0) {
      const teamLabels = team.area_labels ?? [];
      for (const prLabel of areaLabels) {
        for (const configLabel of teamLabels) {
          if (prLabel.startsWith(configLabel)) {
            matchFound = true;
            matchReason = `area label: ${prLabel} (config: ${configLabel})`;
            break;
          }
        }
        if (matchFound) break;
      }
    }

    if (!matchFound) continue;

    log.groupStart(`Processing team: ${team.name}`);
    log.notice(`Team ${team.name} matched via ${matchReason}`);
    matchedTeamCount++;
    matchedTeamNames.push(team.name);

    const channelId = team.slack_channels?.pr ?? '';
    if (!channelId) {
      log.warning(`No Slack channel ID configured for team ${team.name} (slack_channels.pr)`);
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
        color,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `${emoji} External PR: ${prType} (${prSize})`, emoji: true },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*<${prUrl}|${prTitle}>*\nby external contributor @${prAuthor}` },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Files:*\n${prFiles}` },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `+${prAdditions}/-${prDeletions} lines` }],
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

  if (matchedTeamCount === 0) {
    log.notice('No teams matched for the changed files');
  } else {
    log.notice(`Routing summary: matched ${matchedTeamCount} team(s): ${matchedTeamNames.join(', ')}`);
  }
  setOutput('notification_sent', String(notificationSent));
}

// =============================================================================
// WELCOME COMMENT
// =============================================================================

function postWelcomeComment(): void {
  const prNumber = requireEnv('PR_NUMBER');
  const repo = requireEnv('REPO');
  const prType = process.env.PR_TYPE ?? 'feature';

  const comments = execFileSync(
    'gh', ['pr', 'view', prNumber, '--repo', repo, '--json', 'comments', '--jq', '.comments[].body'],
    { encoding: 'utf-8', timeout: 30_000 },
  );

  if (comments.includes('Thanks for your contribution')) {
    console.log('Welcome comment already exists, skipping...');
    return;
  }

  let typeLine: string;
  switch (prType) {
    case 'docs':
      typeLine = 'We\'ve identified this as a **documentation** contribution. ' +
        'For reference, here are the [documentation guidelines](https://github.com/grafana/grafana/tree/main/contribute/documentation).';
      break;
    case 'bugfix':
      typeLine = 'We\'ve identified this as a **bug fix** contribution. ' +
        'Our [pull request guidelines](https://github.com/grafana/grafana/blob/main/contribute/create-pull-request.md) ' +
        'cover what reviewers typically look for in bug fixes, including linking to the related issue and adding regression tests.';
      break;
    default:
      typeLine = 'We\'ve identified this as a **feature** contribution. ' +
        'Our [pull request guidelines](https://github.com/grafana/grafana/blob/main/contribute/create-pull-request.md) ' +
        'cover what reviewers typically look for, including formatting and testing expectations.';
      break;
  }

  const body = [
    'Thanks for your contribution!',
    '',
    'Your PR has been sent to the team for review.',
    '',
    typeLine,
    '',
    'Contributions are reviewed on a best-effort basis, so response times may vary. This bot helps make your contribution more visible to the right team. We appreciate your patience.',
  ].join('\n');

  execFileSync('gh', ['pr', 'comment', prNumber, '--repo', repo, '--body', body], {
    encoding: 'utf-8', timeout: 30_000,
  });
}

// =============================================================================
// AUTO-TRIAGED LABEL
// =============================================================================

function addAutoTriagedLabel(): void {
  const prNumber = requireEnv('PR_NUMBER');
  const repo = requireEnv('REPO');

  console.log('Adding pr/auto-triaged label to track automated triage');
  execFileSync('gh', ['pr', 'edit', prNumber, '--repo', repo, '--add-label', 'pr/auto-triaged'], {
    encoding: 'utf-8', timeout: 30_000,
  });
}

// =============================================================================
// MAIN DISPATCH
// =============================================================================

const action = process.argv[2];

switch (action) {
  case 'metadata':
    getPrMetadata();
    break;
  case 'check-teams':
    checkEnabledTeams();
    break;
  case 'classify':
    await classifyPrType();
    break;
  case 'labels':
    addClassificationLabels();
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
    console.error('Usage: pr-notify.mts {metadata|check-teams|classify|labels|notify|welcome|auto-triaged}');
    process.exit(1);
}
