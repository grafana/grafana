import { describe, it, expect } from "vitest";
import {
    generateTraceID,
    generateParentSpanID,
    generateJobSpanID,
    generateStepSpanID,
    generateStepSpanID_Number,
} from "./trace-ids.js";

const runId = "20137834310";
const runAttempt = "1";
const jobName = "build";
// const jobNumber = "57796136451";
const stepName = "Build Grafana";
const stepNumber = "8";

describe("otel ID generation", () => {
    it("GenerateTraceID", () => {
        const expected = "cfe93a0cde6f53f539e0eaff28e05efc";
        const actual = generateTraceID(runId, runAttempt);

        expect(actual).toBe(expected);
    });

    it("GenerateParentSpanID", () => {
        const expected = "7e173813d01cc668";
        const actual = generateParentSpanID(runId, runAttempt);

        expect(actual).toBe(expected);
    });

    it("GenerateJobSpanID", () => {
        const expected = "b6f4de49eeda5bb7";
        const actual = generateJobSpanID(runId, runAttempt, jobName);

        expect(actual).toBe(expected);
    });

    it("GenerateStepSpanID (by name)", () => {
        const expected = "eecd067487a1f884";
        const actual = generateStepSpanID(
            runId,
            runAttempt,
            jobName,
            stepName
        );

        expect(actual).toBe(expected);
    });

    it("GenerateStepSpanID (by number)", () => {
        const expected = "d70487f07693281c";
        const actual = generateStepSpanID_Number(
            runId,
            runAttempt,
            jobName,
            stepNumber
        );

        expect(actual).toBe(expected);
    });

    it("Deterministic output", () => {
        const trace1 = generateTraceID(runId, runAttempt);
        const trace2 = generateTraceID(runId, runAttempt);
        expect(trace1).toBe(trace2);

        const job1 = generateJobSpanID(runId, runAttempt, jobName);
        const job2 = generateJobSpanID(runId, runAttempt, jobName);
        expect(job1).toBe(job2);

        const step1 = generateStepSpanID(
            runId,
            runAttempt,
            jobName,
            stepName
        );
        const step2 = generateStepSpanID(
            runId,
            runAttempt,
            jobName,
            stepName
        );
        expect(step1).toBe(step2);
    });
});
