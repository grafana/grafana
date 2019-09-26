const core = require('@actions/core');
const github = require('@actions/github');

try {
  console.log(github.context.payload);
} catch (error) {
  core.setFailed(error.message);
}
