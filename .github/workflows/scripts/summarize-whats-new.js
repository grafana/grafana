const core = require('@actions/core');
const { Octokit } = require('@octokit/rest');
const { OpenAI } = require('openai');

const { GITHUB_PR_NUMBER, OPENAI_API_KEY } = process.env;

if (!GITHUB_PR_NUMBER) {
  throw new Error('Missing GITHUB_PR_NUMBER');
}

if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY');
}

const octokit = new Octokit();

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  organization: 'org-pQBHzX720dPLRZbkO7nsvPGy',
});

const fetchGithubPR = async () => {
  try {
    const response = await octokit.pulls.get({
      owner: 'grafana',
      repo: 'grafana',
      pull_number: GITHUB_PR_NUMBER,
    });
    const { title, body } = response.data;

    return { title, body };
  } catch (error) {
    console.error('Error fetching GitHub PR:', error.message);
    return null;
  }
};

const summarizePRWithOpenAI = async (title, body) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Write a what's new post from the provided PR title and body.

Write a vivid description of the problem the feature solves, what it does, and any notable details.
Here's an example:

Introducing Content Outline in Grafana Explore.
It's easy to lose track of your place when you're running complex mixed queries or switching between logs and traces.
Content outline is our first step towards seamless navigation from log lines to traces and back to queries, ensuring quicker searches while preserving context.
Experience efficient, contextual investigations with this update in Grafana Explore.

Title: ${title}
Body: ${body}`,
        },
      ],
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error communicating with OpenAI:', error.message);
    return null;
  }
};

const execute = async () => {
  const prDetails = await fetchGithubPR();

  if (prDetails) {
    const summary = await summarizePRWithOpenAI(prDetails.title, prDetails.body);

    if (summary) {
      if (process.env.GITHUB_ACTION) {
        core.setOutput('summary', summary);
      } else {
        console.log('PR Summary:', summary);
      }
    } else {
      console.error('Failed to summarize PR');
    }
  }
};

execute();
