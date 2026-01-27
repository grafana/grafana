import { createHash } from "crypto";

/**
 * Equivalent to:
 * fmt.Sprintf("%s%st", runID, runAttempt)
 * sha256.Sum256
 * hex.EncodeToString(hash)[:32]
 */
export function generateTraceID(
    runID: string,
    runAttempt: string
): string {
    const input = `${runID}${runAttempt}t`;
    const hash = createHash("sha256").update(input).digest("hex");
    return hash.slice(0, 32);
}

/**
 * Equivalent to:
 * fmt.Sprintf("%s%ss", runID, runAttempt)
 * hex.EncodeToString(hash)[16:32]
 */
export function generateParentSpanID(
    runID: string,
    runAttempt: string
): string {
    const input = `${runID}${runAttempt}s`;
    const hash = createHash("sha256").update(input).digest("hex");
    return hash.slice(16, 32);
}

/**
 * Equivalent to:
 * fmt.Sprintf("%s%s%s", runID, runAttempt, jobName)
 * hex.EncodeToString(hash)[16:32]
 */
export function generateJobSpanID(
    runID: string,
    runAttempt: string,
    jobName: string
): string {
    const input = `${runID}${runAttempt}${jobName}`;
    const hash = createHash("sha256").update(input).digest("hex");
    return hash.slice(16, 32);
}

/**
 * Equivalent to:
 * fmt.Sprintf("%s%s%s%s", runID, runAttempt, jobName, stepName)
 * hex.EncodeToString(hash)[16:32]
 */
export function generateStepSpanID(
    runID: string,
    runAttempt: string,
    jobName: string,
    stepName: string
): string {
    const input = `${runID}${runAttempt}${jobName}${stepName}`;
    const hash = createHash("sha256").update(input).digest("hex");
    return hash.slice(16, 32);
}

/**
 * Equivalent to:
 * fmt.Sprintf("%s%s%s%s", runID, runAttempt, jobName, stepNumber)
 * hex.EncodeToString(hash)[16:32]
 */
export function generateStepSpanID_Number(
    runID: string,
    runAttempt: string,
    jobName: string,
    stepNumber: string
): string {
    const input = `${runID}${runAttempt}${jobName}${stepNumber}`;
    const hash = createHash("sha256").update(input).digest("hex");
    return hash.slice(16, 32);
}
