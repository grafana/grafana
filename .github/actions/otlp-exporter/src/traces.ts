import {WorkflowJobRun, WorkflowRun, WorkflowStep} from "./types.js";
import {generateJobSpanID, generateParentSpanID, generateStepSpanID, generateTraceID} from "./trace-ids.js";
import {Context, ROOT_CONTEXT, Span, SpanContext, trace, TraceFlags} from "@opentelemetry/api";
import assert from "assert";

export function createTrace(jobs: { workflow: WorkflowRun; workflowJobs: WorkflowJobRun[]} ): string {
    const {workflow, workflowJobs} = jobs;

    const {ctx, traceId} = createWorkflowTrace(workflow);

    createJobSpans(workflow, workflowJobs, ctx);

    return traceId;
}

export function createWorkflowTrace(workflowRun: WorkflowRun): {ctx: Context, traceId: string } {
    const traceId = generateTraceID(
        String(workflowRun.id),
        String(workflowRun.run_attempt)
    );

    const spanId = generateParentSpanID(
        String(workflowRun.id),
        String(workflowRun.run_attempt)
    );

    const rootSpanContext: SpanContext = {
        traceId: traceId,
        spanId: spanId,
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED
    };

    let ctx: Context = trace.setSpanContext(ROOT_CONTEXT, rootSpanContext);

    const tracer = trace.getTracer("gha");

    const rootSpan = tracer.startSpan(workflowRun.name, {
            startTime: workflowRun.created_at,
            attributes: {
                "workflow_run_id": workflowRun.id,
                "run_attempt": workflowRun.run_attempt,
                "workflow_name": workflowRun.name,
                "url": workflowRun.html_url,
                "conclusion": workflowRun.conclusion,
            }
        },
        ctx
    );
    rootSpan.end(workflowRun.completed_at);

    ctx = trace.setSpan(ctx, rootSpan);

    return {ctx, traceId};
}

function createJobSpans(
    workflowRun: WorkflowRun,
    workflowJobs: WorkflowJobRun[],
    parentCtx: Context
): void {
    const tracer = trace.getTracer("gha");
    const traceId = trace.getSpanContext(parentCtx)?.traceId;
    assert(traceId, "Trace ID is not set");

    for (const job of workflowJobs) {
        const jobSpanId = generateJobSpanID(
            String(workflowRun.id),
            String(workflowRun.run_attempt),
            job.name
        );

        const jobSpanContext: SpanContext = {
            traceId: traceId,
            spanId: jobSpanId,
            isRemote: true,
            traceFlags: TraceFlags.SAMPLED
        };

        let jobCtx = trace.setSpanContext(parentCtx, jobSpanContext);

        const jobSpan = tracer.startSpan(job.name, {
                startTime: job.started_at,
                attributes: {
                    "job_id": job.id,
                    "job_name": job.name,
                    "run_id": job.run_id,
                    "status": job.status,
                    "conclusion": job.conclusion,
                    "runner_name": job.runner_name ?? undefined,
                    "runner_group_name": job.runner_group_name ?? undefined,
                    "workflow_name": job.workflow_name,
                }
            },
            jobCtx
        );

        jobCtx = trace.setSpan(jobCtx, jobSpan);

        createStepSpans(job, workflowRun, jobCtx);

        // End the job span
        jobSpan.end(job.completed_at);
    }
}

function createStepSpans(
    jobRun: WorkflowJobRun,
    workflowRun: WorkflowRun,
    parentCtx: Context
): void {
    const tracer = trace.getTracer("gha");
    const traceId = trace.getSpanContext(parentCtx)?.traceId;
    assert(traceId, "Trace ID is not set");

    for (const step of jobRun.steps) {
        const stepSpanId = generateStepSpanID(
            String(workflowRun.id),
            String(workflowRun.run_attempt),
            jobRun.name,
            step.name
        );

        const stepSpanContext: SpanContext = {
            traceId: traceId,
            spanId: stepSpanId,
            isRemote: true,
            traceFlags: TraceFlags.SAMPLED
        };

        const stepCtx = trace.setSpanContext(parentCtx, stepSpanContext);

        const stepSpan = tracer.startSpan(step.name, {
                startTime: step.started_at,
                attributes: {
                    "step_name": step.name,
                    "conclusion": step.conclusion,
                }
            },
            stepCtx
        );

        stepSpan.end(step.completed_at);
    }
}

