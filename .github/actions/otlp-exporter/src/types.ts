export type WorkflowStep = {
    readonly name: string
    readonly conclusion: string
    readonly started_at: Date
    readonly completed_at: Date
}
export type WorkflowJobRun = {
    readonly created_at: Date
    readonly started_at: Date
    readonly completed_at: Date
    readonly id: number
    readonly name: string
    readonly run_id: number
    readonly status: 'completed'
    readonly conclusion: string
    readonly runner_name: string | null
    readonly runner_group_name: string | null
    readonly workflow_name: string
    readonly steps: WorkflowStep[]
}

export type WorkflowRun = {
    readonly id: number
    readonly name: string
    readonly conclusion: string
    readonly created_at: Date
    readonly completed_at: Date
    readonly run_attempt: number
    readonly html_url: string
    readonly repository: {
        readonly full_name: string
    }
}

export type WorkflowContext = {
    readonly owner: string
    readonly repo: string
    readonly runId: number
    readonly attempt_number: number
}
export type WorkflowResults = {
    workflow: WorkflowRun
    workflowJobs: WorkflowJobRun[]
}