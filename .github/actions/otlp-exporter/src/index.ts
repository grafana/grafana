import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token || token.trim() === "") {
      throw new Error("GITHUB_TOKEN is not set or empty");
    }

    const repoInput = core.getInput("repo");
    const [owner, repo] = repoInput.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid repo input: "${repoInput}"`);
    }

    const octokit = github.getOctokit(token);

    const runs = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 5
    });

    if (runs.data.workflow_runs.length === 0) {
      core.info("No workflow runs found.");
      return;
    }

    for (const run of runs.data.workflow_runs) {
      core.info(`Run ${run.id}: ${run.name} (${run.status}, ${run.conclusion})`);

      const jobs = await octokit.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: run.id
      });

      for (const job of jobs.data.jobs) {
        core.info(`  Job ${job.id} - ${job.name}: ${job.status} / ${job.conclusion}`);
      }
    }
  } catch (err: any) {
    core.setFailed(err.message);
  }
}

run();
