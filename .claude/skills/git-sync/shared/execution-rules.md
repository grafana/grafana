# Execution Rules

**This is a test-only run. You MUST follow these rules:**

1. **No code changes.** Do not modify any Grafana source code or test files. Configuration files (e.g., feature toggles) may be changed only as directed by the Prerequisites section. You are testing the product as-is, not fixing it.
2. **Do not stop on failure.** When a step fails, encounters a bug, or produces unexpected behavior -- document it and move on to the next step. Do not attempt to debug or fix the root cause. If a failure blocks subsequent steps, apply a minimal workaround to unblock the flow and note it in the report. **Workaround must use the same mechanism as the original step** (e.g., retry with slightly different input, skip to a later step that creates the needed state). Do not switch to a different API or creation method -- the resource may not behave the same way in subsequent steps.
3. **Handle transient connection-loss alerts carefully.** Record the alert, wait for recovery or retry the same UI action once, and only treat it as a product failure if it persists while /api/health is still OK. See "Transient Connection-Loss Alerts" in gotchas.md.
4. **Complete the entire flow.** Execute every step from start to finish, including cleanup. Skipping steps after a failure loses coverage.
5. **Produce a final report.** After completing all steps (or reaching the end), output a structured report:

   ### Report Format

   ```
   ## Test Run Report

   **Skill:** <skill name>
   **Date:** <date>
   **Status:** PASS | PARTIAL | FAIL

   ### Steps Completed
   - Step N: <description> -- PASS | FAIL
     - [if FAIL] **Issue:** <what happened, expected vs actual>

   ### Summary
   - Total steps: N
   - Passed: N
   - Failed: N
   - Blocked (could not attempt due to prior failure state): N

   ### Issues Found
   1. **[Step N] <title>**: <description of the bug or unexpected behavior>
   ```

6. **Budget your time.** Allocate effort across all phases, not just the first. If a phase is consuming disproportionate time due to repeated failures or workarounds, document what you've observed and advance to the next phase. Partial coverage of every phase is more valuable than exhaustive coverage of one.
