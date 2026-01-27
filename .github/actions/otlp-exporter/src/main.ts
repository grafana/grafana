import * as dotenv from "dotenv";
import {createGithubClient, getRunData} from "./github.js";
import {createTrace} from "./traces.js";
import {initTracing, shutdownTracing} from "./tracing.js";
import assert from "assert";

dotenv.config();


async function main() {
    initTracing();

    try {
        const token = process.env.GITHUB_TOKEN;
        assert(token, "GITHUB_TOKEN is not set");

        const repoInput = process.env.REPO;
        assert(repoInput, "REPO is not set");

        const [owner, repo] = repoInput.split("/");
        assert(owner, "REPO owner is not set");
        assert(repo, "REPO name is not set");

        const workflow = process.env.WORKFLOW_NAME;
        assert(workflow, "WORKFLOW_NAME is not set");

        let runIdString = process.env.RUN_ID;
        assert(runIdString, "RUN_ID is not set");

        const runId = parseInt(runIdString);
        assert(!isNaN(runId), "RUN_ID is not a number");

        let attemptString = process.env.RUN_ATTEMPT;
        assert(attemptString, "RUN_ATTEMPT is not set");

        const attempt = parseInt(attemptString);
        assert(!isNaN(attempt), "RUN_ATTEMPT is not a number");

        const oktokit = createGithubClient(token);
        console.log(`Fetching ${workflow} jobs for ${owner}/${repo}`);

        const jobs = await getRunData(oktokit, {
            owner: owner,
            repo: repo,
            name: workflow,
            runId: runId,
            attempt: attempt,
        })

        const traceId = createTrace(jobs)

        console.log(`Trace ID: ${traceId}`);

    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await shutdownTracing();
    }
}

main().catch(console.error);
