
module.exports = async ({ name, github, context, core }) => {
    const { owner, repo } = context.repo;
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${context.runId}/jobs`
    const result = await github.request(url);
    const job = result.data.jobs.find(j => j.name === name);
    
    core.setOutput('link', `${job.html_url}?check_suite_focus=true`);
}
