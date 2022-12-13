
module.exports = async ({ github, context, core }) => {
    const name = "Detect breaking changes";
    const { owner, repo } = context.repo;
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${context.runId}/jobs`
    
    const result = await github.request(url);
    const job = result.jobs.find(j => j.name === name);
    const stepIndex = job.steps.findIndex(s => s.name === name);
    const link = `${job.html_url}#step:${stepIndex + 1}:1`;
    
    core.setOutput('link', link);
}