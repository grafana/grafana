
module.exports = async ({ github, context, core }) => {
    const { owner, repo } = context.repo;
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${context.runId}/jobs`
    const result = await github.request(url)
    const link = `https://github.com/grafana/grafana/runs/${result.data.jobs[0].id}?check_suite_focus=true`;

    core.setOutput('link', link);
}