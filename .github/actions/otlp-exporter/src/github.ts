import {Octokit} from "@octokit/rest";
import {retryAsync} from "ts-retry";
import {Endpoints} from "@octokit/types";
import assert from "assert";
import {WorkflowRun, WorkflowJobRun, WorkflowStep} from "./types.js";

export type WorkflowResponse =
    Endpoints['GET /repos/{owner}/{repo}/actions/runs/{run_id}']['response']['data']
export type WorkflowJobsResponse =
    Endpoints['GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs']['response']['data']['jobs']
export type WorkflowJobResponse = WorkflowJobsResponse[number]
export type WorkflowStepResponse = NonNullable<
    WorkflowJobResponse['steps']
>[number]

export interface JobInfo {
    name: string;
    owner: string;
    repo: string;
    runId: number;
    attempt: number;
}

export const createGithubClient = (token: string): Octokit => {
    return new Octokit({
        baseUrl: "https://api.github.com",
        auth: token,
    });
}

export async function getRunData(octokit: Octokit, job: JobInfo): Promise<{
    workflow: WorkflowRun;
    workflowJobs: WorkflowJobRun[]
}> {
    try {
        return await retryAsync(async () => {
            console.log(`Fetching workflow ${job.name} for attempt ${job.attempt}`);
            const workflowResponse = await fetchWorkflow(octokit, job)

            console.log(`Fetching jobs for workflow ${job.name} for attempt ${job.attempt}`);
            const jobsResponse = await fetchWorkflowJobs(octokit, job)

            console.assert(jobsResponse.length > 0, `Workflow run attempt ${job.attempt} has no completed jobs`)
            const workflow = convertWorkflow(workflowResponse, jobsResponse)

            console.log(`Converting jobs for workflow ${job.name} for attempt ${job.attempt}`);
            const jobs = jobsResponse.map(convertWorkflowJobs)
            console.assert(jobs.length > 0, `Workflow run attempt ${job.attempt} has no completed jobs`)

            return {
                workflow: workflow,
                workflowJobs: jobs
            }
        });
    } catch (e) {
        return Promise.reject(e);
    }

}

async function fetchWorkflow(octokit: Octokit, job: JobInfo): Promise<WorkflowResponse> {
    const result = await octokit.rest.actions.getWorkflowRunAttempt({
        owner: job.owner,
        repo: job.repo,
        run_id: job.runId,
        attempt_number: job.attempt
    });

    return result.data
}

async function fetchWorkflowJobs(octokit: Octokit, job: JobInfo): Promise<WorkflowJobsResponse> {
    const result = await octokit.rest.actions.listJobsForWorkflowRunAttempt({
        owner: job.owner,
        repo: job.repo,
        run_id: job.runId,
        attempt_number: job.attempt,
        per_page: 100
    })
    return result.data.jobs
}

function convertWorkflow(workflow: WorkflowResponse, jobs: WorkflowJobsResponse): WorkflowRun {
    assert(workflow.name, `Workflow id is not set for ${workflow.name}`)
    assert(workflow.conclusion, `Workflow conclusion is not set for ${workflow.name}`)
    assert(workflow.created_at, `Workflow created_at is not set for ${workflow.name}`)
    assert(workflow.run_attempt, `Workflow run_attempt is not set for ${workflow.name}`)
    assert(workflow.run_number, `Workflow run_number is not set for ${workflow.name}`)


    const completedAt = jobs.reduce((max, job) => {
        return Math.max(max, new Date(job.completed_at ?? 0).getTime())
    }, 0)

    assert(completedAt > 0, `Workflow completed_at is not set for ${workflow.name}`)

    return {
        id: workflow.id,
        name: workflow.name,
        run_attempt: workflow.run_attempt,
        created_at: new Date(workflow.created_at),
        completed_at: new Date(completedAt),
        html_url: workflow.html_url,
        conclusion: workflow.conclusion,
        repository: {
            full_name: workflow.repository.full_name
        }
    }
}

function convertWorkflowJobs(job: WorkflowJobResponse): WorkflowJobRun {
    assert(job.status === "completed", `Workflow run is not completed yet for job ${job.name}`)
    assert(job.conclusion, `Job conclusion is not set for ${job.name}`)
    assert(job.completed_at, `Job completed_at is not set for ${job.name}`)
    assert(job.workflow_name, `Workflow name is not set for ${job.name}`)

    const steps = job.steps?.map(convertSteps) || [];

    return {
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        created_at: new Date(job.created_at),
        started_at: new Date(job.started_at),
        completed_at: new Date(job.completed_at),

        workflow_name: job.workflow_name,
        run_id: job.run_id,
        steps: job.steps?.map(convertSteps) || [],
        runner_name: job.runner_name,
        runner_group_name: job.runner_group_name
    };
}

function convertSteps(step: WorkflowStepResponse): WorkflowStep {
    assert(step.conclusion, `Step conclusion is not set for ${step.name}`)
    assert(step.started_at, `Step started_at is not set for ${step.name}`)
    assert(step.completed_at, `Step completed_at is not set for ${step.name}`)

    return {
        name: step.name,
        conclusion: step.conclusion,
        started_at: new Date(step.started_at),
        completed_at: new Date(step.completed_at),
    }
}