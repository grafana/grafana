import { type LabelCategory, categorizeLabelKey } from './analysis';
import { type DatasourceCapabilities } from './capabilities';
import { type DashboardIntent } from './types';

/**
 * Curated dashboard intents per category. These are *not* static panel JSON
 * templates — each intent is a name + short description + LLM guidance that the
 * Assistant expands into an actual dashboard using its dashboarding-mode tools.
 *
 * We deliberately ship a broad-but-not-huge set (typically 4–6 per category).
 * A "suggested for your data" batch is generated on demand by the Assistant
 * (see `generateIntents.ts`) and appended to this list at runtime, so the
 * static set only needs to cover the common cases well.
 */
export const INTENTS_BY_CATEGORY: Record<LabelCategory, DashboardIntent[]> = {
  service: [
    {
      id: 'service-health',
      title: 'Service health',
      description:
        'Request rate, error rate and latency across your services. The first place to look when something is slow or returning errors.',
      guidance:
        'Follow the RED method (Rate, Errors, Duration). Build panels for request rate per service, error rate (5xx / total), and p50/p95/p99 latency. Add a template variable for the service label. Prefer histogram_quantile / rate over hard-coded metric names — inspect the datasource to confirm which metrics exist.',
      icon: 'graph-bar',
    },
    {
      id: 'runtime-metrics',
      title: 'Runtime metrics',
      description:
        'Memory, garbage collection and thread activity for your application. Useful when performance feels off but services look healthy.',
      guidance:
        'Focus on runtime health: process memory (RSS / working set), CPU, GC pause counts and durations, thread or goroutine counts, and any language-specific runtime metrics available (process_*, go_*, jvm_*, dotnet_*, python_*). Add a template variable for the service label so the dashboard can be scoped to one app.',
      icon: 'process',
    },
    {
      id: 'errors-latency',
      title: 'Errors & latency',
      description:
        'Zoom in on failing requests and slow endpoints. Great as a follow-up when the health dashboard shows something is wrong.',
      guidance:
        'Break errors down by status code / class and by endpoint or handler where possible. Show slow endpoints with p95/p99 latency. Include a template variable for the service label. Do not invent endpoint labels — discover what actually exists on the datasource before writing queries.',
      icon: 'exclamation-triangle',
    },
    {
      id: 'slo-error-budget',
      title: 'SLOs & error budget',
      description: 'Track service-level objectives and how much error budget is left over your reporting window.',
      guidance:
        'Build a SLO-oriented dashboard: availability (success ratio), latency SLI (fraction of requests below a target), remaining error budget over 7d/30d, and burn rate over 1h/6h/24h. Use recording-rule metrics if the datasource has them, otherwise compose from raw request-count and error-count metrics. Add a template variable for the service label.',
      icon: 'shield',
    },
    {
      id: 'traffic-dependencies',
      title: 'Traffic & dependencies',
      description: 'Where traffic comes from and where each service calls out to. Great for incident scoping.',
      guidance:
        'Show inbound RPS per caller (if source labels exist) and outbound RPS + error rate to downstream services / databases. Include a panel for external dependency error rates when metrics like http_client_requests_seconds or database_client_* exist. Add a template variable for the service label.',
      icon: 'sitemap',
    },
    {
      id: 'saturation-throughput',
      title: 'Saturation & throughput',
      description: 'Where the service is being pushed hardest — queue depth, concurrency, throttling, backpressure.',
      guidance:
        'Focus on the "S" in USE: queue lengths, in-flight requests / concurrency, thread-pool exhaustion, rate-limit rejections, connection-pool waits. Pair each with the corresponding throughput panel. Add a template variable for the service label. Skip panels for signals the datasource does not expose.',
      icon: 'tachometer-fast',
    },
  ],
  namespace: [
    {
      id: 'resource-usage',
      title: 'Resource usage',
      description:
        'CPU, memory and network usage per namespace. Useful for capacity planning and noisy-neighbour checks.',
      guidance:
        'Show CPU cores, memory (working set or RSS), and network in/out per namespace. Include totals across the namespace and top-N pods within it. Add a template variable for the namespace label.',
      icon: 'monitor',
    },
    {
      id: 'workload-overview',
      title: 'Workload overview',
      description: 'Deployments, pod counts and health per namespace. A good starting point for platform teams.',
      guidance:
        'Show pod counts by phase, restart counts, deployment / statefulset availability, and any workload-level metrics available (kube_deployment_*, kube_pod_*, kube_statefulset_*). Add a template variable for the namespace label.',
      icon: 'apps',
    },
    {
      id: 'namespace-quotas',
      title: 'Quotas & limits',
      description: 'Requests, limits and quotas per namespace — the numbers your platform team argues about.',
      guidance:
        'Show CPU / memory requests vs allocatable, resource quota usage (kube_resourcequota, kube_resourcequota_hard) and namespaces approaching their limits. Include a panel for pods pending due to unschedulable resources. Add a template variable for the namespace label.',
      icon: 'lock',
    },
    {
      id: 'namespace-costs',
      title: 'Cost & spend signals',
      description: 'Rough spend attribution across namespaces using CPU-hours, memory-hours, and pod counts.',
      guidance:
        'Use CPU-hours and memory-GiB-hours (rate(container_cpu_usage_seconds_total)) integrated over the range as a proxy for cost. Show top namespaces by CPU-hours, memory-hours, pod count, and PVC usage. Note in a text panel that these are approximations, not authoritative billing figures. Add a template variable for the namespace label.',
      icon: 'dollar-alt',
    },
    {
      id: 'namespace-events',
      title: 'Events & failures',
      description: 'Restarts, OOMKills, image pull errors and other cluster-level events grouped per namespace.',
      guidance:
        'Show restart counts, OOMKilled events (kube_pod_container_status_restarts_total with reason=OOMKilled if available), image-pull errors, and pending pods. Include a table of the noisiest pods over the window. Add a template variable for the namespace label.',
      icon: 'bell',
    },
  ],
  job: [
    {
      id: 'scrape-health',
      title: 'Scrape health',
      description: 'Which scrape targets are up, how long scrapes take, and where samples are being dropped.',
      guidance:
        'Focus on Prometheus meta-metrics: up, scrape_duration_seconds, scrape_samples_scraped, scrape_samples_post_metric_relabeling, and target counts per job. Add a template variable for the job label. Highlight targets that are down or scraping slowly.',
      icon: 'heart-rate',
    },
    {
      id: 'job-overview',
      title: 'Overview by job',
      description: 'A general-purpose starting point when you want to see what a scrape job is producing.',
      guidance:
        'Discover which metric families this job publishes (using the datasource tools), then pick a handful that describe overall activity: request or event rates, error indicators, and one or two latency / duration measures if available. Add a template variable for the job label.',
      icon: 'chart-line',
    },
    {
      id: 'job-cardinality',
      title: 'Cardinality by job',
      description: 'Which jobs are producing the most series and pulling the most weight on your Prometheus.',
      guidance:
        'Show series counts per job (using count by (job) (up) or scrape_samples_post_metric_relabeling), top metric families by cardinality, and churn (delta in series count over time). Include a table of the noisiest jobs. Add a template variable for the job label.',
      icon: 'database',
    },
    {
      id: 'job-freshness',
      title: 'Data freshness',
      description: 'Are we still receiving samples for each job, and how stale is the freshest one?',
      guidance:
        'Show time since last successful scrape per target, jobs with any target older than 5m, and a heatmap of scrape success rate over time. Add a template variable for the job label.',
      icon: 'clock-nine',
    },
  ],
  pod: [
    {
      id: 'pod-resources',
      title: 'Pod resources',
      description: 'CPU, memory and I/O for each pod. Handy for tracking down runaway or throttled pods.',
      guidance:
        'Show CPU (usage and throttling), memory (working set and limit), and disk / network I/O per pod. Include container_cpu_cfs_throttled_seconds_total if available. Add a template variable for the pod label.',
      icon: 'monitor',
    },
    {
      id: 'pod-lifecycle',
      title: 'Pod lifecycle',
      description: 'Restarts, crash loops and readiness across pods. Check this after a rollout goes wrong.',
      guidance:
        'Show pod restart counts, container_last_seen, kube_pod_container_status_restarts_total, kube_pod_container_status_ready, and phase transitions. Add a template variable for the pod label. Surface pods with high restart counts or long unready periods.',
      icon: 'sync',
    },
    {
      id: 'pod-throttling',
      title: 'CPU throttling & pressure',
      description: 'Which pods are being throttled by the kernel or waiting on CPU / memory.',
      guidance:
        'Show throttled CPU time (container_cpu_cfs_throttled_seconds_total), CPU / memory pressure (PSI metrics when available), and utilisation vs limit ratios. Rank pods by percentage of time throttled. Add a template variable for the pod label.',
      icon: 'tachometer-fast',
    },
    {
      id: 'pod-network',
      title: 'Network activity',
      description: 'Inbound / outbound traffic, packet loss, and connection churn per pod.',
      guidance:
        'Show network bytes in/out, TCP retransmits and errors, and active connections per pod. Include the top-N pods by throughput and a comparison of send vs receive. Add a template variable for the pod label. Skip panels for signals the datasource does not expose.',
      icon: 'shield',
    },
  ],
  cluster: [
    {
      id: 'cluster-capacity',
      title: 'Cluster capacity',
      description: 'Nodes, allocatable resources and utilisation across the cluster. Good for capacity reviews.',
      guidance:
        'Show node counts by status, allocatable vs used CPU / memory, pod capacity vs actual pod count, and any cluster-level SLIs available. Add a template variable for the cluster label.',
      icon: 'sitemap',
    },
    {
      id: 'cluster-overview',
      title: 'Cluster overview',
      description: 'A general-purpose starting point summarising workloads and health across the cluster.',
      guidance:
        'Combine workload signals (deployments, pod phases) with a few utilisation metrics (CPU, memory) at the cluster level. Add a template variable for the cluster label.',
      icon: 'apps',
    },
    {
      id: 'cluster-node-health',
      title: 'Node health',
      description: 'Node conditions, taints and pressure signals — where are pods struggling to schedule?',
      guidance:
        'Show node condition counts (Ready, DiskPressure, MemoryPressure, PIDPressure), unschedulable nodes, and node age. Include a table of nodes with recent condition transitions. Add a template variable for the cluster label.',
      icon: 'kubernetes',
    },
    {
      id: 'cluster-control-plane',
      title: 'Control plane health',
      description: 'API server latency, etcd health and controller-manager metrics per cluster.',
      guidance:
        'Show apiserver_request_duration_seconds p99, request rate by verb, apiserver_current_inflight_requests, and etcd_disk_wal_fsync_duration_seconds if available. Skip panels the datasource does not carry rather than inventing metric names. Add a template variable for the cluster label.',
      icon: 'cog',
    },
  ],
  container: [
    {
      id: 'container-resources',
      title: 'Container resources',
      description: 'CPU, memory and network per container. Useful when narrowing down which container is misbehaving.',
      guidance:
        'Show per-container CPU, memory (RSS / working set), and network in/out. Include limit / request comparisons where available. Add template variables for both pod and container labels.',
      icon: 'monitor',
    },
    {
      id: 'container-limits',
      title: 'Requests vs usage',
      description: 'How closely each container is running to its CPU and memory limits.',
      guidance:
        'Show CPU / memory usage vs request and limit per container as percentages. Rank containers by "closest to limit" and by "most wasted headroom". Add template variables for both pod and container labels.',
      icon: 'tachometer-fast',
    },
    {
      id: 'container-restarts',
      title: 'Restart history',
      description: 'Which containers have restarted, when, and how often over the selected range.',
      guidance:
        'Show restart counts over time, containers with restarts in the window, and the reason where available (OOMKilled, Error, CrashLoopBackOff). Add template variables for pod and container labels.',
      icon: 'sync',
    },
  ],
  instance: [
    {
      id: 'host-overview',
      title: 'Host overview',
      description: 'CPU, memory, disk and network for each host. The classic node-health dashboard.',
      guidance:
        'Show per-host CPU, memory, disk usage and network in/out. Include load average or CPU pressure if available. Add a template variable for the instance / host label.',
      icon: 'laptop-cloud',
    },
    {
      id: 'host-disk-io',
      title: 'Disk & IO',
      description: 'Which volumes are filling up, and where reads and writes are queueing.',
      guidance:
        'Show disk usage by filesystem, disk IO throughput, IO await / queue depth, and inodes if available. Highlight filesystems above 80%/90% usage. Add a template variable for the instance / host label.',
      icon: 'database',
    },
    {
      id: 'host-network',
      title: 'Network throughput',
      description: 'Traffic per host with retransmits, errors and drops.',
      guidance:
        'Show per-host network bytes in/out per interface, TCP retransmits, packet errors and drops. Highlight the busiest hosts and any with error rates above 0. Add a template variable for the instance / host label.',
      icon: 'shield',
    },
    {
      id: 'host-fleet',
      title: 'Fleet-wide summary',
      description: 'Compare all hosts at once — which are hottest, coldest, and outliers.',
      guidance:
        'Show fleet-level p50/p95/p99 for CPU, memory and load; a bar chart of top-N hosts by each; and a heatmap of usage over time. Add a template variable for the instance / host label so users can drill into one host.',
      icon: 'graph-bar',
    },
  ],
  deployment: [
    {
      id: 'deployment-rollout',
      title: 'Rollout status',
      description:
        'Desired vs available vs updated replicas across your workloads. Watch this during and after a deploy.',
      guidance:
        'Show desired vs available vs updated / unavailable replicas (kube_deployment_status_replicas*, kube_statefulset_status_replicas*, kube_daemonset_status_*), observed-vs-desired generation lag, and pods not yet ready. Add a template variable for the workload label (and namespace when present). Skip metric families the datasource does not carry.',
      icon: 'sync',
    },
    {
      id: 'deployment-health',
      title: 'Workload health',
      description:
        'Availability and readiness across deployments, statefulsets and daemonsets. A good platform-team starting point.',
      guidance:
        'Show replica availability ratio per workload, workloads below their desired replica count, restart counts, and daemonset scheduled-vs-ready. Include a table of the least-healthy workloads. Add a template variable for the workload label (and namespace when present).',
      icon: 'apps',
    },
    {
      id: 'deployment-resources',
      title: 'Resource usage',
      description: 'CPU and memory per workload, and how usage compares to requests and limits.',
      guidance:
        'Aggregate container CPU / memory usage up to the owning workload (sum by workload), compare against requests and limits, and rank workloads by usage and by closeness to their limits. Add a template variable for the workload label (and namespace when present).',
      icon: 'monitor',
    },
    {
      id: 'deployment-restarts',
      title: 'Restarts & failures',
      description: 'Which workloads are crash-looping, restarting, or getting OOMKilled over the window.',
      guidance:
        'Show restart counts over time per workload, containers with recent restarts, and OOMKilled / CrashLoopBackOff reasons where available (kube_pod_container_status_restarts_total, kube_pod_container_status_last_terminated_reason). Add a template variable for the workload label (and namespace when present).',
      icon: 'exclamation-triangle',
    },
  ],
  node: [
    {
      id: 'node-overview',
      title: 'Node overview',
      description: 'Conditions, capacity and top consumers per node. The first place to look at cluster hardware.',
      guidance:
        'Combine node conditions (Ready, plus Disk/Memory/PID pressure), allocatable vs used CPU / memory, pod count vs capacity, and top-N nodes by utilisation. Prefer kube_node_* and node-exporter / cAdvisor metrics; skip families the datasource does not carry. Add a template variable for the node label.',
      icon: 'kubernetes',
    },
    {
      id: 'node-capacity',
      title: 'Capacity & allocation',
      description: 'Allocatable resources vs requests and limits — where is the cluster running out of room?',
      guidance:
        'Show allocatable CPU / memory per node, summed pod requests and limits vs allocatable (kube_node_status_allocatable, kube_pod_container_resource_requests / _limits), pod capacity vs running pods, and the nodes closest to saturation. Add a template variable for the node label.',
      icon: 'sitemap',
    },
    {
      id: 'node-resources',
      title: 'Resource usage',
      description: 'CPU, memory, disk and network for each node.',
      guidance:
        'Show per-node CPU utilisation, memory working set vs total, filesystem usage, and network in/out. Include load average or CPU pressure if available and rank the busiest nodes. Add a template variable for the node label.',
      icon: 'monitor',
    },
    {
      id: 'node-conditions',
      title: 'Conditions & pressure',
      description:
        'Node conditions, pressure signals and evictions — why are pods being evicted or failing to schedule?',
      guidance:
        'Show node condition counts (Ready, DiskPressure, MemoryPressure, PIDPressure, NetworkUnavailable), unschedulable / cordoned nodes, recent evictions, and condition transitions over time. Add a template variable for the node label.',
      icon: 'heart-rate',
    },
  ],
  other: [
    {
      id: 'label-overview',
      title: 'Overview',
      description: 'A general-purpose starting point that breaks the most relevant metrics down by this label.',
      guidance:
        'Pick 6–10 panels that summarise the most useful signals available on the datasource (activity rates, error indicators, latencies, resource usage) and add a template variable for the chosen label.',
      icon: 'chart-line',
    },
    {
      id: 'top-items',
      title: 'Top items',
      description: 'The biggest hitters for this label — busiest, slowest, or most error-prone.',
      guidance:
        'Show top-N values for the label by activity, error count, and latency where applicable. Use topk() queries. Add a template variable for the label so the user can filter.',
      icon: 'list-ul',
    },
    {
      id: 'label-breakdown',
      title: 'Breakdown & comparison',
      description: 'Side-by-side comparison of activity, errors and latency across the values of this label.',
      guidance:
        'Show stacked time series and a comparison table breaking each metric down by the label. Include a small heatmap where useful. Add a template variable so the user can narrow to a subset. Confirm every metric name against the datasource before querying.',
      icon: 'columns',
    },
    {
      id: 'label-anomalies',
      title: 'Anomalies & outliers',
      description: 'Values of this label that are behaving unusually compared to their peers.',
      guidance:
        'Show z-scores or deviations from the median across values of this label for the most important metrics (rate, error rate, latency). Rank the top outliers. Note in a text panel that these are heuristic — real anomaly detection requires history. Add a template variable for the label.',
      icon: 'exclamation-triangle',
    },
  ],
};

/**
 * Capability-driven intents. These are appended to the category set when the
 * detected capabilities on the datasource suggest they'll be useful.
 *
 * Each entry pairs a curated intent with a predicate over `DatasourceCapabilities`
 * and the currently-selected label category. We keep the predicates deliberately
 * narrow — false positives waste the user's time.
 */
interface CapabilityIntent {
  intent: DashboardIntent;
  matches: (capabilities: DatasourceCapabilities, category: LabelCategory) => boolean;
}

export const CAPABILITY_INTENTS: CapabilityIntent[] = [
  {
    intent: {
      id: 'postgres-query-performance',
      title: 'Postgres query performance',
      description:
        'Slow queries, execution time distribution, and index / cache hit ratios for your Postgres backends.',
      guidance:
        'Focus on postgres_exporter / pg_stat_statements-style metrics: query counts, total / mean execution time, buffer / block hit ratios, dead-tuple percentages. Include a template variable for the pivot label. Prefer rate() on _total counters; do not invent metric names — check what the datasource actually carries.',
      icon: 'database',
    },
    matches: (c) => c.databases.includes('postgres'),
  },
  {
    intent: {
      id: 'postgres-connections-locks',
      title: 'Postgres connections & locks',
      description: 'Connection saturation, waiting backends, deadlocks and long-running transactions.',
      guidance:
        'Show active vs max connections, waiting connections, deadlocks_total, longest running transactions, and lock contention (pg_locks by mode) where available. Add a template variable for the pivot label.',
      icon: 'lock',
    },
    matches: (c) => c.databases.includes('postgres'),
  },
  {
    intent: {
      id: 'mysql-overview',
      title: 'MySQL performance',
      description: 'Query rate, slow queries, buffer pool usage and connection pressure for MySQL.',
      guidance:
        "Focus on mysqld_exporter metrics: queries per second, slow_queries, threads_running vs threads_connected, innodb_buffer_pool_reads / read_requests (hit ratio), and replication lag if applicable. Prefer rate() on counters. Don't invent metrics — inspect what's available.",
      icon: 'database',
    },
    matches: (c) => c.databases.includes('mysql'),
  },
  {
    intent: {
      id: 'redis-overview',
      title: 'Redis latency & memory',
      description: 'Command latency, hit rate, memory pressure and eviction rate for Redis.',
      guidance:
        'Show total commands per second, hit / miss ratio, memory used vs maxmemory, evictions, and expired keys. Include a latency panel if instantaneous_latency or command duration metrics exist. Add a template variable for the pivot label.',
      icon: 'database',
    },
    matches: (c) => c.databases.includes('redis'),
  },
  {
    intent: {
      id: 'kafka-consumer-lag',
      title: 'Kafka consumer lag',
      description: 'Which consumer groups are falling behind and by how much, per topic and partition.',
      guidance:
        'Focus on kafka_consumer_group_lag / kafka_consumergroup_lag by group / topic / partition, records-consumed rate, and time-since-last-commit. Include top-N lagging groups. Skip panels for metrics not present on this datasource.',
      icon: 'clock-nine',
    },
    matches: (c) => c.databases.includes('kafka'),
  },
  {
    intent: {
      id: 'kafka-broker-health',
      title: 'Kafka broker health',
      description: 'Broker throughput, under-replicated partitions, and controller / ISR health.',
      guidance:
        'Show messages-in / bytes-in / bytes-out per broker, under-replicated partitions, offline partitions, controller count, and request handler idle ratio if available. Add a template variable for the broker / instance label.',
      icon: 'heart-rate',
    },
    matches: (c) => c.databases.includes('kafka'),
  },
  {
    intent: {
      id: 'mongodb-overview',
      title: 'MongoDB operations',
      description: 'Operation rate by type, connection usage, replication lag and cache activity.',
      guidance:
        'Focus on mongodb_exporter metrics: opcounters (insert / query / update / delete), connections_current vs available, replication lag for members, and wiredTiger cache hit ratio. Include a template variable for the pivot label.',
      icon: 'database',
    },
    matches: (c) => c.databases.includes('mongodb'),
  },
  {
    intent: {
      id: 'otel-red-semconv',
      title: 'OpenTelemetry RED (semantic conventions)',
      description: 'Rate, errors and latency built on OTel semantic-convention metric names.',
      guidance:
        "Use OTel semantic-convention metrics if present (http.server.request.duration, http.server.request.duration_seconds, rpc.server.duration). Group by service.name (and http.route where it exists). Show request rate, error rate (status_code >= 500 / total), and p50 / p95 / p99. Don't fall back to Prometheus-style names if OTel metrics are available.",
      icon: 'sitemap',
    },
    matches: (c, category) =>
      c.metricConventions.includes('opentelemetry') && (category === 'service' || category === 'other'),
  },
  {
    intent: {
      id: 'istio-service-mesh',
      title: 'Service mesh (Istio)',
      description: 'Golden signals from Istio / Envoy proxy metrics — RED per service via the mesh.',
      guidance:
        'Use istio_requests_total, istio_request_duration_milliseconds_bucket, and istio_request_bytes / istio_response_bytes. Show RPS, error ratio (response_code >= 500), and p50 / p95 / p99 latency, grouped by destination_service or source_workload. Add a template variable for the pivot label.',
      icon: 'sitemap',
    },
    matches: (c) => c.serviceMesh.includes('istio'),
  },
  {
    intent: {
      id: 'envoy-proxy',
      title: 'Envoy proxy dashboard',
      description: 'Upstream / downstream request activity and connection health from Envoy metrics.',
      guidance:
        'Use envoy_http_downstream_rq_* and envoy_cluster_upstream_rq_* families. Show downstream RPS + response-code breakdown, upstream retries and timeouts, and connection pool health per cluster. Add a template variable for the pivot label.',
      icon: 'sitemap',
    },
    matches: (c) => c.serviceMesh.includes('envoy') && !c.serviceMesh.includes('istio'),
  },
  {
    intent: {
      id: 'jvm-runtime-deep-dive',
      title: 'JVM heap & GC deep-dive',
      description: 'Heap by pool, GC pause / count, thread activity and classloading for JVM apps.',
      guidance:
        'Focus on jvm_memory_bytes_used by area / pool, jvm_gc_pause_seconds (count + sum), jvm_threads_current, jvm_classes_loaded, jvm_gc_memory_promoted_bytes if available. Include a heap-usage-vs-committed panel per pool. Add a template variable for the pivot label.',
      icon: 'process',
    },
    matches: (c) => c.runtimes.includes('jvm'),
  },
  {
    intent: {
      id: 'go-runtime-deep-dive',
      title: 'Go runtime deep-dive',
      description: 'Goroutines, GC pauses, memory heap and scheduler latency for Go apps.',
      guidance:
        'Use go_goroutines, go_gc_duration_seconds (histogram — p50/p95/p99), go_memstats_heap_inuse_bytes, go_memstats_alloc_bytes_total (rate), and go_sched_latencies_seconds if available. Add a template variable for the pivot label.',
      icon: 'process',
    },
    matches: (c) => c.runtimes.includes('go'),
  },
  {
    intent: {
      id: 'nodejs-runtime',
      title: 'Node.js runtime health',
      description: 'Event loop lag, heap size, active handles and GC pauses for Node.js apps.',
      guidance:
        "Use nodejs_eventloop_lag_seconds (p50/p95/p99), nodejs_heap_size_used_bytes vs nodejs_heap_size_total_bytes, nodejs_active_handles_total, nodejs_gc_duration_seconds. Add a template variable for the pivot label. Skip panels the datasource doesn't carry.",
      icon: 'process',
    },
    matches: (c) => c.runtimes.includes('nodejs'),
  },
  {
    intent: {
      id: 'python-runtime',
      title: 'Python runtime health',
      description: 'GC collections, resident memory, open file descriptors and thread activity for Python apps.',
      guidance:
        'Use python_gc_collections_total and python_gc_objects_collected_total broken down by generation, process_resident_memory_bytes vs process_virtual_memory_bytes, process_open_fds vs process_max_fds, and python_info for the interpreter version. For OTel-instrumented apps prefer process_runtime_cpython_* (memory, gc_count, cpu_time, context_switches). Group by the pivot label and add a template variable for it. Skip metric families the datasource does not carry.',
      icon: 'process',
    },
    matches: (c) => c.runtimes.includes('python'),
  },
  {
    intent: {
      id: 'dotnet-runtime',
      title: '.NET runtime health',
      description: 'GC heap by generation, thread pool pressure, lock contention and exception rate for .NET apps.',
      guidance:
        'Use dotnet_* / process_runtime_dotnet_* metrics: GC heap size per generation (gen 0/1/2 and LOH), gc_collections_count and gc_allocated_bytes rate, thread-pool thread count and queue length, monitor_lock_contention_count rate, exceptions_count rate, and JIT compiled bytes / time when present. Group by the pivot label and add a template variable for it. Skip metric families the datasource does not carry.',
      icon: 'process',
    },
    matches: (c) => c.runtimes.includes('dotnet'),
  },
  {
    intent: {
      id: 'ruby-runtime',
      title: 'Ruby runtime health',
      description: 'GC runs, heap slots, object allocation and thread / GVL activity for Ruby apps.',
      guidance:
        'Use ruby_* / process_runtime_ruby_* metrics: GC count and total time, heap live vs free slots, allocated-objects rate, major vs minor GC counts, and thread count. When a Puma / Sidekiq exporter is present add worker utilisation and queue backlog panels. Group by the pivot label and add a template variable for it. Skip metric families the datasource does not carry.',
      icon: 'process',
    },
    matches: (c) => c.runtimes.includes('ruby'),
  },
  {
    intent: {
      id: 'k8s-pod-rollout',
      title: 'Deployment rollouts',
      description: 'Rollout progress, replica counts and pod availability during deploys.',
      guidance:
        'Show kube_deployment_status_replicas vs kube_deployment_spec_replicas, kube_deployment_status_replicas_available / _updated / _unavailable, and pod restart counts within the deployment. Add a template variable for namespace and, when useful, deployment.',
      icon: 'sync',
    },
    matches: (c, category) =>
      c.kubernetes.kubeStateMetrics && (category === 'namespace' || category === 'pod' || category === 'cluster'),
  },
  {
    intent: {
      id: 'aws-cloudwatch-overview',
      title: 'AWS resource overview',
      description: 'A cross-service AWS view built from CloudWatch metrics ingested by Prometheus.',
      guidance:
        'Use aws_* / cloudwatch_* metric families. Pick 6–10 signals across compute (EC2 CPU, network), managed services (RDS connections + CPU, SQS queue depth, Lambda errors + duration), and load balancers (5xx counts, target unhealthy hosts). Add a template variable for the pivot label. Skip services not present.',
      icon: 'cloud',
    },
    matches: (c) => c.clouds.includes('aws'),
  },
];

/**
 * Curated intents for the label the user picked, optionally re-ranked by the
 * capabilities we detected on the datasource.
 *
 * Capability-driven intents come first because they're the most specific match
 * (a "Postgres query performance" intent is more useful than "Service health" if
 * the datasource is clearly a postgres_exporter target). We de-duplicate by intent
 * id so a capability intent that also lives in the category list is only shown
 * once.
 */
export function getIntentsForLabel(labelKey: string, capabilities?: DatasourceCapabilities): DashboardIntent[] {
  const category = categorizeLabelKey(labelKey);
  const categoryIntents = INTENTS_BY_CATEGORY[category];
  if (!capabilities) {
    return categoryIntents;
  }

  const capabilityMatches = CAPABILITY_INTENTS.filter((ci) => ci.matches(capabilities, category)).map(
    (ci) => ci.intent
  );

  const seen = new Set<string>();
  const merged: DashboardIntent[] = [];
  for (const intent of [...capabilityMatches, ...categoryIntents]) {
    if (seen.has(intent.id)) {
      continue;
    }
    seen.add(intent.id);
    merged.push(intent);
  }
  return merged;
}
