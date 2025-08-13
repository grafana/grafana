# Jobs Controller

### Behavior
- Watches provisioning `Jobs` and emits notifications on job creation.
- Optionally cleans up `HistoricJobs` after a configurable expiration. Disable when job history is stored in Loki.

- Queueing and claiming:
  - Creating a `Job` enqueues work. Drivers “claim” one job at a time under a time-bound lease so only one worker processes it at once.
  - If a driver crashes or loses its lease, cleanup makes the job eligible to be claimed again. This yields at-least-once processing.
  - New job notifications reduce latency; periodic ticks ensure progress even without notifications.

- Processing and status:
  - A supporting worker processes the job, renewing the lease in the background. If lease renewal fails or expires, processing aborts.
  - Status updates are persisted with conflict-aware retries. Progress is throttled to avoid excessive writes while still providing timely feedback.
  - When processing finishes, the job is marked complete and a copy is written to history.

- Historic jobs role:
  - Historic jobs are a read-only audit trail and UX surface for recent job outcomes, progress summaries, errors, and reference URLs.
- Retention is implementation-dependent: this controller can prune old history objects periodically, or history can be stored in Loki; when using Loki, disable local cleanup with `--history-expiration=0`.

This binary currently wires informers and emits job-create notifications. In the full setup, concurrent drivers consume notifications and execute workers to process jobs using the behavior above.

### Flags
- `--token` (string): Token to use for authentication against the provisioning API.
- `--token-exchange-url` (string): Token exchange endpoint used to mint the access token for the provisioning API.
- `--provisioning-server-url` (string): Base URL to the provisioning API server (e.g., `https://localhost:6446`).
- `--history-expiration` (duration): If greater than zero, enables HistoricJobs cleanup and sets the retention window (e.g., `30s`, `15m`, `24h`). If `0`, cleanup is disabled.

### How to run
1. Build from this folder:
   - `make build`
2. Ensure the following services are running locally: provisioning API server, secrets service API server, repository controller, unified storage, and auth.
3. Start the controller:
   - Using Loki for job history:
     - Ensure the Provisioning API is configured with Loki for job history (see `createJobHistoryConfigFromSettings` in `pkg/registry/apis/provisioning/register.go`).
     - Run without history cleanup:
       - `./bin/job-controller --token-exchange-url=http://localhost:6481/sign/access-token --token=ProvisioningAdminToken --provisioning-server-url=https://localhost:6446`
   - Without Loki (local/dev or when Loki is unavailable):
     - Run without cleanup:
       - `./bin/job-controller --token-exchange-url=http://localhost:6481/sign/access-token --token=ProvisioningAdminToken --provisioning-server-url=https://localhost:6446`
     - Or enable local HistoricJobs cleanup with a retention window:
       - `./bin/job-controller --token-exchange-url=http://localhost:6481/sign/access-token --token=ProvisioningAdminToken --provisioning-server-url=https://localhost:6446 --history-expiration=30s`

### Expected behavior
1. Create a repository and enqueue a job.
2. The controller emits a notification on job creation.
3. In a full setup with the concurrent driver, workers claim and process jobs, updating status and writing history.
4. Entries move to `HistoricJobs`; if cleanup is enabled, older entries are pruned based on `--history-expiration`.
