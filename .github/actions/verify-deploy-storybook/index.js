const core = require('@actions/core');
const github = require('@actions/github');

const DEPLOY_STORYBOOK_LABEL = 'deploy-storybook';

try {
  const pullRequest = github.context.payload.pull_request;
  let shouldDeploy = false;
  console.log(pullRequest);
  console.log(pullRequest.labels);
  if(pullRequest && pullRequest.labels) {
     shouldDeploy = !!(pullRequest.labels.find(l => l === DEPLOY_STORYBOOK_LABEL))
  }
  core.setOutput('shouldDeploy', shouldDeploy.toString());
} catch (error) {
  core.setFailed(error.message);
}
