const core = require('@actions/core');
const github = require('@actions/github');

try {
  const milestone = github.context.payload.pull_request.milestone;

  if (!milestone) {
    core.setFailed('This pull request has no milestone assigned! Please assign an open milestone.');
    return;
  }

  console.log(`Milestone: ${milestone}!`);

  if (milestone.closed) {
    core.setFailed('Milestone ' + milestone.title + ' is closed! Please assign an open milestone.');
    return;
  }

  const versionPattern = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z\.]+))?/;
  const match = versionPattern.exec(milestone.title);
  if (!match) {
    core.setFailed('Could not parse Milestone title ' + milestone.title);
    return;
  }

  const major = Number(match[1]);
  const minor = Number(match[2] || 0);
  const patch = Number(match[3] || 0);
  const meta = match[4];

  core.setOutput('major', major.toString());
  core.setOutput('minor', minor.toString());
  core.setOutput('patch', patch.toString());
  core.setOutput('meta', meta.toString());
} catch (error) {
  core.setFailed(error.message);
}
