// Command seed creates a diverse set of Grafana resources for semantic search testing.
//
// Usage:
//
//	go run ./pkg/storage/unified/resource/semantic/testdata/seed.go [--grafana-url http://localhost:3000] [--cleanup]
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var (
	grafanaURL = flag.String("grafana-url", "http://localhost:3000", "Grafana base URL")
	cleanup    = flag.Bool("cleanup", false, "Delete seeded resources instead of creating them")
	user       = flag.String("user", "admin", "Grafana admin username")
	pass       = flag.String("pass", "admin", "Grafana admin password")
)

const p = "seed-"

// --- Data model ---

type folder struct{ UID, Title, Description string }
type dashboard struct {
	UID, Title, Description, FolderUID string
	Tags                               []string
}
type datasource struct{ UID, Name, Type, URL string }
type playlist struct{ UID, Name, Interval string }
type alertRule struct{ UID, Title, FolderUID, RuleGroup string }
type team struct{ Name string }
type annotation struct {
	Text, DashboardUID string
	Tags               []string
}
type libraryPanel struct{ UID, Name, FolderUID string }

// --- Domain definitions ---

var allFolders = []folder{
	// Infrastructure
	{p + "infra", "Infrastructure", "Physical and virtual server monitoring"},
	{p + "infra-compute", "Compute Resources", "CPU, memory, and process monitoring"},
	{p + "infra-storage", "Storage Systems", "Disk, SAN, NAS, and object storage"},
	{p + "infra-os", "Operating Systems", "Linux, Windows, and OS-level metrics"},
	{p + "infra-hw", "Hardware Health", "IPMI, power, cooling, and firmware"},
	// Kubernetes
	{p + "k8s", "Kubernetes", "Container orchestration and cluster management"},
	{p + "k8s-workloads", "K8s Workloads", "Pods, deployments, statefulsets, and jobs"},
	{p + "k8s-cluster", "K8s Cluster", "Nodes, namespaces, and cluster-level resources"},
	{p + "k8s-networking", "K8s Networking", "Services, ingress, and service mesh"},
	// Databases
	{p + "db", "Databases", "Relational and NoSQL database monitoring"},
	{p + "db-sql", "SQL Databases", "PostgreSQL, MySQL, and MSSQL"},
	{p + "db-nosql", "NoSQL Databases", "MongoDB, Cassandra, and DynamoDB"},
	// Caching
	{p + "cache", "Caching & Key-Value", "Redis, Memcached, and CDN caches"},
	// Application
	{p + "app", "Application Performance", "API and microservice monitoring"},
	{p + "app-api", "API Monitoring", "REST, gRPC, and GraphQL endpoints"},
	{p + "app-frontend", "Frontend Performance", "Web vitals, JavaScript errors, and UX"},
	{p + "app-mobile", "Mobile Applications", "iOS and Android app health"},
	// Business
	{p + "biz", "Business Intelligence", "Revenue, growth, and product analytics"},
	{p + "biz-revenue", "Revenue & Finance", "MRR, ARR, billing, and payments"},
	{p + "biz-product", "Product Analytics", "Feature adoption, engagement, and retention"},
	// E-commerce
	{p + "ecom", "E-commerce", "Online store and marketplace monitoring"},
	// Network
	{p + "net", "Network Operations", "Network infrastructure and connectivity"},
	{p + "net-dns", "DNS & Domain", "DNS resolution and domain management"},
	{p + "net-lb", "Load Balancing", "Load balancers and traffic distribution"},
	// Security
	{p + "sec", "Security & Compliance", "Security monitoring and compliance"},
	{p + "sec-audit", "Audit & Access", "Access logs and permission tracking"},
	{p + "sec-vuln", "Vulnerability Management", "CVE tracking and remediation"},
	// CI/CD
	{p + "cicd", "CI/CD & DevOps", "Build, test, and deployment pipelines"},
	{p + "cicd-builds", "Build Pipelines", "Compilation, testing, and artifacts"},
	{p + "cicd-deploy", "Deployments", "Release management and rollouts"},
	// FinOps
	{p + "finops", "FinOps & Cloud Costs", "Cloud spending and optimization"},
	{p + "finops-aws", "AWS Costs", "Amazon Web Services billing"},
	{p + "finops-gcp", "GCP Costs", "Google Cloud Platform billing"},
	// SRE
	{p + "sre", "SRE & Reliability", "Service level objectives and incident management"},
	{p + "sre-slo", "SLOs & Error Budgets", "Service level tracking"},
	{p + "sre-incidents", "Incident Management", "MTTR, postmortems, and on-call"},
	// ML
	{p + "ml", "Machine Learning", "ML model monitoring and training"},
	{p + "ml-training", "ML Training", "Training jobs and experiment tracking"},
	{p + "ml-inference", "ML Inference", "Model serving and prediction quality"},
	// Message Queues
	{p + "mq", "Message Queues & Streaming", "Event streaming and async processing"},
	// IoT
	{p + "iot", "IoT & Edge Computing", "Device fleets and sensor networks"},
	// Observability
	{p + "obs", "Observability Platform", "Monitoring the monitoring stack"},
	// Data Engineering
	{p + "data", "Data Engineering", "ETL, warehouses, and data quality"},
	// Compliance
	{p + "gov", "Compliance & Governance", "Regulatory and policy compliance"},
}

var allDashboards = []dashboard{
	// Infrastructure - Compute
	{p + "cpu-overview", "CPU Utilization Overview", "Real-time CPU usage across all hosts broken down by user, system, iowait, and steal time", p + "infra-compute", []string{"infrastructure", "cpu"}},
	{p + "cpu-heatmap", "CPU Core Heatmap", "Per-core CPU utilization heatmap showing hotspots and imbalanced workloads", p + "infra-compute", []string{"infrastructure", "cpu", "heatmap"}},
	{p + "memory-usage", "Memory and Swap Utilization", "Physical memory usage, page faults, swap activity, and OOM killer events", p + "infra-compute", []string{"infrastructure", "memory"}},
	{p + "process-explorer", "Process Explorer", "Top processes by CPU and memory consumption with process tree visualization", p + "infra-compute", []string{"infrastructure", "processes"}},
	{p + "load-avg", "System Load Average", "1-minute, 5-minute, and 15-minute load averages with capacity thresholds", p + "infra-compute", []string{"infrastructure", "load"}},
	{p + "vm-perf", "Virtual Machine Performance", "VMware/KVM hypervisor metrics including vCPU ready time and memory ballooning", p + "infra-compute", []string{"infrastructure", "vm", "hypervisor"}},
	// Infrastructure - Storage
	{p + "disk-io", "Disk I/O Throughput", "Read/write bytes per second, IOPS, and I/O queue depth by device", p + "infra-storage", []string{"infrastructure", "disk", "iops"}},
	{p + "disk-latency", "Disk Latency Analysis", "Average and percentile I/O latency with outlier detection", p + "infra-storage", []string{"infrastructure", "disk", "latency"}},
	{p + "fs-usage", "Filesystem Usage", "Mount point capacity, inode usage, and projected time to full", p + "infra-storage", []string{"infrastructure", "storage", "capacity"}},
	{p + "s3-bucket", "S3 Bucket Analytics", "Object count, total size, request rates, and access patterns for S3 buckets", p + "infra-storage", []string{"infrastructure", "s3", "aws"}},
	{p + "nfs-perf", "NFS Performance", "NFS operation latency, retransmits, and server-side IOPS", p + "infra-storage", []string{"infrastructure", "nfs", "storage"}},
	// Infrastructure - OS
	{p + "linux-overview", "Linux Host Overview", "Single-pane-of-glass showing CPU, memory, disk, network, and systemd services", p + "infra-os", []string{"infrastructure", "linux"}},
	{p + "windows-svr", "Windows Server Monitoring", "Windows performance counters, event log summaries, and IIS metrics", p + "infra-os", []string{"infrastructure", "windows"}},
	{p + "systemd-svc", "Systemd Service Health", "Service status, restart frequency, and dependency chain visualization", p + "infra-os", []string{"infrastructure", "systemd", "linux"}},
	{p + "kernel-metrics", "Kernel Performance Metrics", "Context switches, interrupts, entropy pool, and file descriptor usage", p + "infra-os", []string{"infrastructure", "kernel", "linux"}},
	// Infrastructure - Hardware
	{p + "ipmi-sensors", "IPMI Sensor Readings", "Temperature, fan speed, voltage, and power supply status from BMC", p + "infra-hw", []string{"infrastructure", "ipmi", "hardware"}},
	{p + "ups-power", "UPS and Power Distribution", "Battery charge, input/output voltage, load percentage, and runtime remaining", p + "infra-hw", []string{"infrastructure", "power", "ups"}},
	{p + "datacenter-env", "Data Center Environment", "Rack temperature, humidity, airflow, and cooling efficiency metrics", p + "infra-hw", []string{"infrastructure", "datacenter", "cooling"}},

	// Kubernetes - Workloads
	{p + "k8s-pod-health", "Kubernetes Pod Health", "Pod status, restart counts, readiness probes, and container resource usage", p + "k8s-workloads", []string{"kubernetes", "pods"}},
	{p + "k8s-deploy-status", "Deployment Rollout Status", "Desired vs available replicas, rollout progress, and rolling update metrics", p + "k8s-workloads", []string{"kubernetes", "deployments"}},
	{p + "k8s-statefulset", "StatefulSet Management", "Ordinal index status, PVC binding, and ordered rollout tracking", p + "k8s-workloads", []string{"kubernetes", "statefulset"}},
	{p + "k8s-jobs", "Job and CronJob Monitoring", "Job completion rates, duration, failure reasons, and schedule adherence", p + "k8s-workloads", []string{"kubernetes", "jobs", "cron"}},
	{p + "k8s-hpa", "Horizontal Pod Autoscaler", "Current vs desired replicas, scaling events, and target metric utilization", p + "k8s-workloads", []string{"kubernetes", "hpa", "autoscaling"}},
	{p + "k8s-daemonset", "DaemonSet Coverage", "DaemonSet scheduling status and node coverage across the cluster", p + "k8s-workloads", []string{"kubernetes", "daemonset"}},
	{p + "k8s-oom", "Container OOM Kill Tracker", "Out-of-memory kill events, memory limit vs actual usage, and affected pods", p + "k8s-workloads", []string{"kubernetes", "oom", "memory"}},
	// Kubernetes - Cluster
	{p + "k8s-node-res", "Node Resource Allocation", "Allocatable vs requested CPU and memory across all nodes", p + "k8s-cluster", []string{"kubernetes", "nodes", "capacity"}},
	{p + "k8s-ns-quotas", "Namespace Resource Quotas", "Resource quota usage per namespace with limit warnings", p + "k8s-cluster", []string{"kubernetes", "namespaces", "quotas"}},
	{p + "k8s-etcd", "etcd Cluster Health", "etcd leader elections, disk sync duration, and database size", p + "k8s-cluster", []string{"kubernetes", "etcd"}},
	{p + "k8s-api-server", "API Server Performance", "Request latency, admission webhook duration, and rate limiting", p + "k8s-cluster", []string{"kubernetes", "apiserver"}},
	{p + "k8s-scheduler", "Scheduler Performance", "Scheduling latency, pending pods, and preemption events", p + "k8s-cluster", []string{"kubernetes", "scheduler"}},
	{p + "k8s-pvc", "Persistent Volume Claims", "PVC binding status, storage class utilization, and volume expansion events", p + "k8s-cluster", []string{"kubernetes", "storage", "pvc"}},
	// Kubernetes - Networking
	{p + "k8s-ingress", "Ingress Controller Metrics", "Request rate, error percentage, and TLS certificate expiry by ingress", p + "k8s-networking", []string{"kubernetes", "ingress", "nginx"}},
	{p + "k8s-svc-mesh", "Service Mesh Overview", "Istio/Envoy sidecar proxy metrics, mTLS status, and traffic policies", p + "k8s-networking", []string{"kubernetes", "istio", "servicemesh"}},
	{p + "k8s-netpol", "Network Policy Audit", "Allowed and denied traffic flows between namespaces and pods", p + "k8s-networking", []string{"kubernetes", "networkpolicy", "security"}},
	{p + "k8s-coredns", "CoreDNS Performance", "DNS query rate, cache hit ratio, and resolution errors within the cluster", p + "k8s-networking", []string{"kubernetes", "dns", "coredns"}},

	// Databases - SQL
	{p + "pg-perf", "PostgreSQL Performance", "Query throughput, connection pool utilization, lock waits, and vacuum activity", p + "db-sql", []string{"database", "postgresql"}},
	{p + "pg-replication", "PostgreSQL Replication", "Streaming replication lag, WAL generation rate, and standby status", p + "db-sql", []string{"database", "postgresql", "replication"}},
	{p + "pg-slow", "PostgreSQL Slow Queries", "Queries exceeding duration thresholds with execution plan analysis", p + "db-sql", []string{"database", "postgresql", "slow-queries"}},
	{p + "mysql-perf", "MySQL Query Analysis", "QPS by statement type, InnoDB buffer pool hit ratio, and thread activity", p + "db-sql", []string{"database", "mysql"}},
	{p + "mysql-repl", "MySQL Replication Health", "Seconds behind master, relay log position, and GTID consistency", p + "db-sql", []string{"database", "mysql", "replication"}},
	{p + "mssql-perf", "SQL Server Performance", "Batch requests per second, plan cache hit ratio, and wait statistics", p + "db-sql", []string{"database", "mssql", "sqlserver"}},
	{p + "db-connections", "Database Connection Pools", "Active, idle, and waiting connections across all database instances", p + "db-sql", []string{"database", "connections", "pool"}},
	{p + "db-backup", "Database Backup Status", "Last backup timestamps, duration, size, and verification results", p + "db-sql", []string{"database", "backup", "recovery"}},
	// Databases - NoSQL
	{p + "mongo-perf", "MongoDB Performance", "Operation counters, document metrics, and WiredTiger cache utilization", p + "db-nosql", []string{"database", "mongodb"}},
	{p + "mongo-replicaset", "MongoDB Replica Set", "Replica set member status, oplog window, and election events", p + "db-nosql", []string{"database", "mongodb", "replication"}},
	{p + "cassandra-perf", "Cassandra Cluster Health", "Read/write latency, compaction progress, and tombstone warnings", p + "db-nosql", []string{"database", "cassandra"}},
	{p + "dynamo-perf", "DynamoDB Performance", "Consumed capacity units, throttled requests, and GSI utilization", p + "db-nosql", []string{"database", "dynamodb", "aws"}},
	{p + "cockroach-perf", "CockroachDB Overview", "SQL statement statistics, range distribution, and liveness status", p + "db-nosql", []string{"database", "cockroachdb"}},

	// Caching
	{p + "redis-perf", "Redis Performance", "Commands per second, hit rate, memory usage, and connected clients", p + "cache", []string{"cache", "redis"}},
	{p + "redis-cluster", "Redis Cluster Health", "Slot distribution, node connectivity, and failover events", p + "cache", []string{"cache", "redis", "cluster"}},
	{p + "memcached-perf", "Memcached Performance", "Get/set rates, hit ratio, eviction count, and connection utilization", p + "cache", []string{"cache", "memcached"}},
	{p + "varnish-perf", "Varnish Cache Performance", "Cache hit ratio, backend connection health, and ban list size", p + "cache", []string{"cache", "varnish", "cdn"}},
	{p + "cdn-perf", "CDN Performance", "Edge cache hit ratio, origin shield effectiveness, and bandwidth by region", p + "cache", []string{"cache", "cdn", "performance"}},

	// Application - API
	{p + "http-latency", "HTTP Request Latency", "Request duration p50, p95, p99 by endpoint with error rate breakdown", p + "app-api", []string{"application", "http", "latency"}},
	{p + "grpc-metrics", "gRPC Service Metrics", "Unary and streaming call rates, error codes, and per-method latency", p + "app-api", []string{"application", "grpc"}},
	{p + "graphql-perf", "GraphQL Performance", "Query complexity scores, resolver execution times, and error rates", p + "app-api", []string{"application", "graphql"}},
	{p + "websocket-conn", "WebSocket Connections", "Active connections, message throughput, and disconnection reasons", p + "app-api", []string{"application", "websocket"}},
	{p + "api-gateway", "API Gateway Overview", "Rate limiting, authentication failures, and route-level traffic", p + "app-api", []string{"application", "apigateway"}},
	{p + "microservices", "Microservice Dependency Map", "Service-to-service call graph, failure cascades, and circuit breaker status", p + "app-api", []string{"application", "microservices", "dependencies"}},
	{p + "retry-budget", "Retry and Timeout Budget", "Retry rates, timeout occurrences, and adaptive concurrency limits", p + "app-api", []string{"application", "retry", "resilience"}},
	// Application - Frontend
	{p + "cwv", "Core Web Vitals", "LCP, FID, CLS scores across pages with trend analysis", p + "app-frontend", []string{"frontend", "webvitals", "performance"}},
	{p + "js-errors", "JavaScript Error Tracking", "Uncaught exceptions, promise rejections, and error grouping by stack trace", p + "app-frontend", []string{"frontend", "javascript", "errors"}},
	{p + "page-load", "Page Load Performance", "Time to first byte, DOM content loaded, and resource waterfall analysis", p + "app-frontend", []string{"frontend", "performance", "pageload"}},
	{p + "user-sessions", "User Session Analytics", "Session duration, pages per session, bounce rate, and engagement score", p + "app-frontend", []string{"frontend", "sessions", "analytics"}},
	{p + "csp-violations", "CSP Violation Reports", "Content Security Policy violations by directive and blocked URI", p + "app-frontend", []string{"frontend", "security", "csp"}},
	// Application - Mobile
	{p + "mobile-crashes", "Mobile App Crash Reports", "Crash-free session rate, top crash signatures, and affected OS versions", p + "app-mobile", []string{"mobile", "crashes", "stability"}},
	{p + "mobile-anr", "Android ANR Analysis", "Application Not Responding events, main thread blocking, and stack traces", p + "app-mobile", []string{"mobile", "android", "anr"}},
	{p + "mobile-startup", "App Startup Time", "Cold start, warm start, and hot start durations by app version", p + "app-mobile", []string{"mobile", "performance", "startup"}},
	{p + "mobile-network", "Mobile Network Performance", "API call latency from mobile clients, retry rates, and offline queue depth", p + "app-mobile", []string{"mobile", "network", "api"}},
	{p + "push-delivery", "Push Notification Delivery", "Delivery rate, open rate, and time-to-display by platform and campaign", p + "app-mobile", []string{"mobile", "push", "notifications"}},

	// Business - Revenue
	{p + "mrr-arr", "MRR and ARR Tracking", "Monthly and annual recurring revenue trends with expansion and contraction", p + "biz-revenue", []string{"business", "revenue", "mrr"}},
	{p + "churn-analysis", "Customer Churn Analysis", "Churn rate by cohort, leading indicators, and win-back campaign effectiveness", p + "biz-revenue", []string{"business", "churn", "retention"}},
	{p + "billing-health", "Billing and Payment Health", "Invoice generation, payment success rates, and dunning workflow metrics", p + "biz-revenue", []string{"business", "billing", "payments"}},
	{p + "arpu-ltv", "ARPU and Customer Lifetime Value", "Average revenue per user, LTV by acquisition channel, and payback period", p + "biz-revenue", []string{"business", "arpu", "ltv"}},
	{p + "subscription-metrics", "Subscription Metrics", "Trial starts, trial-to-paid conversion, upgrades, downgrades, and cancellations", p + "biz-revenue", []string{"business", "subscriptions"}},
	// Business - Product
	{p + "feature-adoption", "Feature Adoption Heatmap", "Usage frequency by feature, time to first use, and retention by feature", p + "biz-product", []string{"business", "features", "adoption"}},
	{p + "ab-tests", "A/B Test Results", "Experiment variants, statistical significance, and conversion lift", p + "biz-product", []string{"business", "abtesting", "experiments"}},
	{p + "nps-csat", "NPS and Customer Satisfaction", "Net promoter scores, CSAT surveys, and sentiment analysis trends", p + "biz-product", []string{"business", "nps", "satisfaction"}},
	{p + "onboarding", "User Onboarding Funnel", "Step completion rates, drop-off points, and time-to-value metrics", p + "biz-product", []string{"business", "onboarding", "funnel"}},
	{p + "dau-mau", "Daily and Monthly Active Users", "DAU/MAU ratio, stickiness trends, and power user segmentation", p + "biz-product", []string{"business", "engagement", "users"}},

	// E-commerce
	{p + "checkout-flow", "Checkout Flow Performance", "Cart-to-purchase conversion, step abandonment, and payment method distribution", p + "ecom", []string{"ecommerce", "checkout", "conversion"}},
	{p + "cart-abandon", "Cart Abandonment Analysis", "Abandonment rates by stage, recovery email effectiveness, and price sensitivity", p + "ecom", []string{"ecommerce", "cart", "abandonment"}},
	{p + "payment-gateway", "Payment Gateway Health", "Transaction success rate by provider, decline codes, and processing latency", p + "ecom", []string{"ecommerce", "payments", "gateway"}},
	{p + "inventory-stock", "Inventory and Stock Levels", "Stock availability, reorder point alerts, and warehouse fulfillment times", p + "ecom", []string{"ecommerce", "inventory", "fulfillment"}},
	{p + "fraud-detection", "Fraud Detection Dashboard", "Fraud score distribution, flagged transactions, and false positive rates", p + "ecom", []string{"ecommerce", "fraud", "security"}},
	{p + "shipping-track", "Shipping and Delivery Tracking", "Delivery times by carrier, tracking update frequency, and SLA compliance", p + "ecom", []string{"ecommerce", "shipping", "delivery"}},

	// Network
	{p + "net-bandwidth", "Network Bandwidth Utilization", "Inbound/outbound throughput per interface with capacity planning", p + "net", []string{"network", "bandwidth"}},
	{p + "net-packet-loss", "Packet Loss and Jitter", "Packet loss percentage, jitter measurements, and MTU issues by path", p + "net", []string{"network", "packetloss", "jitter"}},
	{p + "firewall-rules", "Firewall Rule Analytics", "Allowed and denied traffic by rule, top talkers, and geo-blocking effectiveness", p + "net", []string{"network", "firewall", "security"}},
	{p + "vpn-tunnels", "VPN Tunnel Status", "Tunnel uptime, renegotiation events, and throughput per VPN connection", p + "net", []string{"network", "vpn", "connectivity"}},
	{p + "bgp-routing", "BGP Routing Status", "BGP peer state, prefix announcements, route flapping, and AS path changes", p + "net", []string{"network", "bgp", "routing"}},
	{p + "dns-resolution", "DNS Resolution Monitoring", "Query latency, NXDOMAIN rates, cache hit ratio, and resolver health", p + "net-dns", []string{"network", "dns"}},
	{p + "dns-sec", "DNSSEC Validation", "DNSSEC signature validation success rate and key rotation tracking", p + "net-dns", []string{"network", "dnssec", "security"}},
	{p + "lb-health", "Load Balancer Health", "Backend pool health, connection draining, and request distribution fairness", p + "net-lb", []string{"network", "loadbalancer"}},
	{p + "haproxy-stats", "HAProxy Statistics", "Frontend/backend sessions, queue depth, and response time percentiles", p + "net-lb", []string{"network", "haproxy", "proxy"}},
	{p + "snmp-devices", "SNMP Network Device Monitoring", "Switch port utilization, router CPU, and network equipment health via SNMP", p + "net", []string{"network", "snmp", "switches"}},

	// Security
	{p + "audit-logs", "Audit Log Explorer", "User login events, permission changes, API access patterns, and session tracking", p + "sec-audit", []string{"security", "audit"}},
	{p + "failed-logins", "Failed Login Analysis", "Brute force detection, geographic anomalies, and credential stuffing indicators", p + "sec-audit", []string{"security", "authentication", "bruteforce"}},
	{p + "rbac-changes", "RBAC Permission Changes", "Role assignments, privilege escalation events, and least-privilege compliance", p + "sec-audit", []string{"security", "rbac", "permissions"}},
	{p + "waf-events", "WAF Event Analysis", "Web application firewall blocks, rule triggers, and false positive tuning", p + "sec", []string{"security", "waf", "firewall"}},
	{p + "ddos-mitigation", "DDoS Mitigation Dashboard", "Attack volume, mitigation effectiveness, and origin analysis", p + "sec", []string{"security", "ddos", "mitigation"}},
	{p + "tls-certs", "TLS Certificate Inventory", "Certificate expiry dates, chain validation, and protocol version distribution", p + "sec", []string{"security", "tls", "certificates"}},
	{p + "secrets-rotation", "Secrets Rotation Status", "API key age, password rotation compliance, and credential scanning results", p + "sec", []string{"security", "secrets", "rotation"}},
	{p + "cve-scanner", "Container Image CVE Scanner", "Vulnerability counts by severity, unpatched images, and remediation progress", p + "sec-vuln", []string{"security", "cve", "vulnerabilities"}},
	{p + "siem-overview", "SIEM Event Overview", "Security event classification, alert triage queue, and threat intelligence matches", p + "sec", []string{"security", "siem", "threats"}},

	// CI/CD
	{p + "build-success", "Build Success Rate", "Build pass/fail rates, flaky test detection, and queue wait times", p + "cicd-builds", []string{"cicd", "builds"}},
	{p + "build-duration", "Build Duration Trends", "Average build time by project, stage-level breakdown, and cache effectiveness", p + "cicd-builds", []string{"cicd", "builds", "performance"}},
	{p + "test-coverage", "Test Coverage Report", "Code coverage percentages, uncovered critical paths, and coverage trends", p + "cicd-builds", []string{"cicd", "testing", "coverage"}},
	{p + "artifact-registry", "Artifact Registry Usage", "Image push/pull rates, storage consumption, and vulnerability scan results", p + "cicd-builds", []string{"cicd", "artifacts", "registry"}},
	{p + "deploy-freq", "Deployment Frequency", "DORA metric for how often code ships to production by team", p + "cicd-deploy", []string{"cicd", "dora", "deployments"}},
	{p + "lead-time", "Lead Time for Changes", "DORA metric from commit to production deployment by service", p + "cicd-deploy", []string{"cicd", "dora", "leadtime"}},
	{p + "change-failure", "Change Failure Rate", "DORA metric for percentage of deployments causing incidents", p + "cicd-deploy", []string{"cicd", "dora", "failures"}},
	{p + "gitops-sync", "GitOps Sync Status", "ArgoCD/Flux sync state, drift detection, and reconciliation timing", p + "cicd-deploy", []string{"cicd", "gitops", "argocd"}},
	{p + "feature-flags", "Feature Flag Status", "Flag states, rollout percentages, and experiment assignments", p + "cicd-deploy", []string{"cicd", "featureflags"}},
	{p + "rollback-tracker", "Rollback Tracker", "Rollback frequency, time-to-rollback, and affected services", p + "cicd-deploy", []string{"cicd", "rollback"}},

	// FinOps
	{p + "aws-billing", "AWS Cost Explorer", "Daily and monthly AWS spending by service, account, and region", p + "finops-aws", []string{"finops", "aws", "billing"}},
	{p + "aws-ri", "AWS Reserved Instance Utilization", "RI coverage, unused reservations, and savings plan effectiveness", p + "finops-aws", []string{"finops", "aws", "reservedinstances"}},
	{p + "aws-spot", "AWS Spot Instance Analytics", "Spot interruption rates, savings vs on-demand, and fallback events", p + "finops-aws", []string{"finops", "aws", "spot"}},
	{p + "gcp-billing", "GCP Billing Dashboard", "Google Cloud costs by project, SKU, and label with budget alerts", p + "finops-gcp", []string{"finops", "gcp", "billing"}},
	{p + "cloud-waste", "Cloud Resource Waste Detection", "Idle instances, unattached volumes, and oversized resources", p + "finops", []string{"finops", "waste", "optimization"}},
	{p + "cost-per-team", "Cost Allocation by Team", "Cloud spending attributed to engineering teams via tags and labels", p + "finops", []string{"finops", "allocation", "teams"}},
	{p + "rightsizing", "Instance Rightsizing Recommendations", "CPU and memory utilization vs instance size with downsize suggestions", p + "finops", []string{"finops", "rightsizing", "optimization"}},

	// SRE
	{p + "slo-overview", "SLO Overview", "Service level objectives status, remaining error budget, and burn rate", p + "sre-slo", []string{"sre", "slo", "reliability"}},
	{p + "error-budget", "Error Budget Consumption", "Error budget remaining by service, burn rate alerts, and budget reset schedule", p + "sre-slo", []string{"sre", "errorbudget"}},
	{p + "burn-rate", "SLO Burn Rate Dashboard", "Multi-window burn rate calculations with fast and slow alert thresholds", p + "sre-slo", []string{"sre", "burnrate", "alerting"}},
	{p + "mttr-tracker", "MTTR Tracker", "Mean time to recovery trends, incident severity distribution, and responder metrics", p + "sre-incidents", []string{"sre", "mttr", "incidents"}},
	{p + "incident-freq", "Incident Frequency Analysis", "Incident count by service, time-of-day patterns, and recurring issue detection", p + "sre-incidents", []string{"sre", "incidents", "trends"}},
	{p + "postmortem", "Postmortem Action Tracking", "Action item completion rate, overdue items, and lessons learned catalog", p + "sre-incidents", []string{"sre", "postmortem"}},
	{p + "oncall-load", "On-Call Load Distribution", "Alert volume per rotation, after-hours pages, and responder fatigue metrics", p + "sre-incidents", []string{"sre", "oncall", "pagerduty"}},
	{p + "chaos-eng", "Chaos Engineering Results", "Chaos experiment outcomes, blast radius, and system resilience scores", p + "sre", []string{"sre", "chaos", "resilience"}},

	// Machine Learning
	{p + "ml-training-jobs", "ML Training Job Monitor", "Training run duration, loss curves, and GPU/TPU utilization", p + "ml-training", []string{"ml", "training", "gpu"}},
	{p + "ml-experiments", "ML Experiment Tracking", "Hyperparameter sweep results, model comparison, and experiment lineage", p + "ml-training", []string{"ml", "experiments", "mlflow"}},
	{p + "ml-gpu-util", "GPU Cluster Utilization", "GPU memory usage, CUDA core utilization, and job scheduling queue depth", p + "ml-training", []string{"ml", "gpu", "cuda"}},
	{p + "ml-model-accuracy", "Model Accuracy Monitoring", "Prediction accuracy, precision, recall, and F1 score trends in production", p + "ml-inference", []string{"ml", "accuracy", "monitoring"}},
	{p + "ml-feature-drift", "Feature Drift Detection", "Distribution shift in input features compared to training data baseline", p + "ml-inference", []string{"ml", "drift", "features"}},
	{p + "ml-inference-lat", "Inference Latency", "Model serving response times, batch vs real-time prediction performance", p + "ml-inference", []string{"ml", "inference", "latency"}},
	{p + "ml-data-quality", "ML Data Quality", "Missing values, outlier detection, and schema validation for ML pipelines", p + "ml-training", []string{"ml", "dataquality"}},

	// Message Queues
	{p + "kafka-overview", "Kafka Cluster Overview", "Broker health, partition distribution, and under-replicated partitions", p + "mq", []string{"kafka", "streaming"}},
	{p + "kafka-consumer", "Kafka Consumer Lag", "Consumer group lag, partition assignment, and rebalancing events", p + "mq", []string{"kafka", "consumerlag"}},
	{p + "kafka-topics", "Kafka Topic Analytics", "Message rate per topic, partition count, and retention utilization", p + "mq", []string{"kafka", "topics"}},
	{p + "rabbitmq-queues", "RabbitMQ Queue Health", "Queue depth, consumer count, message rates, and unacknowledged messages", p + "mq", []string{"rabbitmq", "queues"}},
	{p + "rabbitmq-dlq", "Dead Letter Queue Monitor", "Dead-lettered message count, retry exhaustion, and poison pill detection", p + "mq", []string{"rabbitmq", "deadletter"}},
	{p + "sqs-metrics", "AWS SQS Metrics", "Messages in flight, visibility timeout, and approximate queue age", p + "mq", []string{"aws", "sqs", "queues"}},
	{p + "nats-perf", "NATS Messaging Performance", "Message throughput, slow consumers, and JetStream stream health", p + "mq", []string{"nats", "messaging"}},

	// IoT
	{p + "iot-fleet", "IoT Device Fleet Overview", "Online/offline device count, firmware versions, and connectivity uptime", p + "iot", []string{"iot", "devices", "fleet"}},
	{p + "iot-sensors", "Sensor Telemetry Dashboard", "Temperature, humidity, pressure, and accelerometer readings from field sensors", p + "iot", []string{"iot", "sensors", "telemetry"}},
	{p + "iot-gateway", "Edge Gateway Health", "Gateway CPU, memory, message buffering, and upstream connectivity", p + "iot", []string{"iot", "edge", "gateway"}},
	{p + "iot-firmware", "Firmware OTA Updates", "Update rollout progress, success rate, and rollback incidents", p + "iot", []string{"iot", "firmware", "ota"}},
	{p + "iot-battery", "Device Battery Analytics", "Battery levels, charge cycle counts, and estimated replacement schedule", p + "iot", []string{"iot", "battery", "power"}},

	// Observability Platform
	{p + "prom-health", "Prometheus Health", "Scrape duration, target up/down, TSDB compaction, and WAL size", p + "obs", []string{"observability", "prometheus"}},
	{p + "loki-ingestion", "Loki Ingestion Pipeline", "Log volume by tenant, ingestion rate, and distributor/ingester health", p + "obs", []string{"observability", "loki", "logs"}},
	{p + "tempo-traces", "Tempo Trace Pipeline", "Spans per second, trace search latency, and compactor throughput", p + "obs", []string{"observability", "tempo", "traces"}},
	{p + "mimir-metrics", "Mimir Metrics Pipeline", "Active series count, ingestion rate, and query frontend performance", p + "obs", []string{"observability", "mimir", "metrics"}},
	{p + "grafana-usage", "Grafana Instance Usage", "Dashboard views, active users, query volume, and data source health", p + "obs", []string{"observability", "grafana", "usage"}},
	{p + "alertmanager-health", "Alertmanager Health", "Notification delivery rate, silence effectiveness, and alert group sizes", p + "obs", []string{"observability", "alertmanager"}},

	// Data Engineering
	{p + "etl-pipeline", "ETL Pipeline Health", "Job success rate, data volume processed, and pipeline latency", p + "data", []string{"data", "etl", "pipeline"}},
	{p + "airflow-dags", "Airflow DAG Performance", "DAG run duration, task failure rates, and scheduler queue depth", p + "data", []string{"data", "airflow", "orchestration"}},
	{p + "dbt-jobs", "dbt Transformation Jobs", "Model build times, test pass rates, and freshness SLAs", p + "data", []string{"data", "dbt", "transforms"}},
	{p + "warehouse-queries", "Data Warehouse Query Performance", "Query execution times, slot utilization, and cost per query", p + "data", []string{"data", "warehouse", "bigquery"}},
	{p + "data-freshness", "Data Freshness Monitor", "Last update timestamps by table, staleness alerts, and SLA compliance", p + "data", []string{"data", "freshness", "quality"}},
	{p + "data-quality", "Data Quality Scorecards", "Completeness, uniqueness, consistency, and validity checks by dataset", p + "data", []string{"data", "quality", "validation"}},

	// Compliance
	{p + "gdpr-requests", "GDPR Data Subject Requests", "Request volume, processing time, and SLA compliance for data rights", p + "gov", []string{"compliance", "gdpr", "privacy"}},
	{p + "data-retention", "Data Retention Compliance", "Retention policy adherence, purge job status, and storage impact", p + "gov", []string{"compliance", "retention", "policy"}},
	{p + "access-reviews", "Access Review Dashboard", "Pending reviews, completion rates, and excess permission findings", p + "gov", []string{"compliance", "access", "reviews"}},
	{p + "license-audit", "Software License Audit", "License utilization, compliance gaps, and renewal tracking", p + "gov", []string{"compliance", "licensing", "audit"}},
	{p + "change-mgmt", "Change Management Tracker", "Change requests, approval workflows, and emergency change frequency", p + "gov", []string{"compliance", "change", "management"}},
}

var allDatasources = []datasource{
	// Prometheus instances
	{p + "ds-prom-prod-us", "Prometheus Prod US-East", "prometheus", "http://prometheus-prod-us:9090"},
	{p + "ds-prom-prod-eu", "Prometheus Prod EU-West", "prometheus", "http://prometheus-prod-eu:9090"},
	{p + "ds-prom-prod-ap", "Prometheus Prod AP-Southeast", "prometheus", "http://prometheus-prod-ap:9090"},
	{p + "ds-prom-staging", "Prometheus Staging", "prometheus", "http://prometheus-staging:9090"},
	{p + "ds-prom-dev", "Prometheus Dev", "prometheus", "http://prometheus-dev:9090"},
	{p + "ds-prom-k8s", "Prometheus K8s Cluster", "prometheus", "http://prometheus-k8s:9090"},
	{p + "ds-prom-infra", "Prometheus Infrastructure", "prometheus", "http://prometheus-infra:9090"},
	{p + "ds-prom-ml", "Prometheus ML Workloads", "prometheus", "http://prometheus-ml:9090"},
	// Loki instances
	{p + "ds-loki-prod", "Loki Production Logs", "loki", "http://loki-prod:3100"},
	{p + "ds-loki-staging", "Loki Staging Logs", "loki", "http://loki-staging:3100"},
	{p + "ds-loki-security", "Loki Security Audit Logs", "loki", "http://loki-security:3100"},
	{p + "ds-loki-app", "Loki Application Logs", "loki", "http://loki-app:3100"},
	// Tempo instances
	{p + "ds-tempo-prod", "Tempo Production Traces", "tempo", "http://tempo-prod:3200"},
	{p + "ds-tempo-staging", "Tempo Staging Traces", "tempo", "http://tempo-staging:3200"},
	// SQL databases
	{p + "ds-pg-prod", "PostgreSQL Production", "postgres", "postgres-prod:5432"},
	{p + "ds-pg-analytics", "PostgreSQL Analytics Replica", "postgres", "postgres-analytics:5432"},
	{p + "ds-pg-warehouse", "PostgreSQL Data Warehouse", "postgres", "postgres-warehouse:5432"},
	{p + "ds-mysql-prod", "MySQL Production", "mysql", "mysql-prod:3306"},
	{p + "ds-mysql-legacy", "MySQL Legacy Application", "mysql", "mysql-legacy:3306"},
	{p + "ds-mssql-erp", "SQL Server ERP System", "mssql", "mssql-erp:1433"},
	// NoSQL
	{p + "ds-mongo-prod", "MongoDB Production Cluster", "mongodb", "mongodb-prod:27017"},
	{p + "ds-mongo-analytics", "MongoDB Analytics", "mongodb", "mongodb-analytics:27017"},
	// Cloud
	{p + "ds-cloudwatch", "AWS CloudWatch", "cloudwatch", ""},
	{p + "ds-stackdriver", "GCP Cloud Monitoring", "stackdriver", ""},
	{p + "ds-azure-mon", "Azure Monitor", "grafana-azure-monitor-datasource", ""},
	// Elasticsearch
	{p + "ds-es-logs", "Elasticsearch Log Analytics", "elasticsearch", "http://es-logs:9200"},
	{p + "ds-es-apm", "Elasticsearch APM", "elasticsearch", "http://es-apm:9200"},
	{p + "ds-es-security", "Elasticsearch Security Events", "elasticsearch", "http://es-security:9200"},
	// InfluxDB
	{p + "ds-influx-iot", "InfluxDB IoT Telemetry", "influxdb", "http://influxdb-iot:8086"},
	{p + "ds-influx-metrics", "InfluxDB Infrastructure Metrics", "influxdb", "http://influxdb-metrics:8086"},
	// Other
	{p + "ds-graphite", "Graphite Legacy Metrics", "graphite", "http://graphite:8080"},
	{p + "ds-jaeger", "Jaeger Tracing", "jaeger", "http://jaeger:16686"},
	{p + "ds-pyroscope", "Pyroscope Continuous Profiling", "grafana-pyroscope-datasource", "http://pyroscope:4040"},
	{p + "ds-clickhouse", "ClickHouse Analytics", "grafana-clickhouse-datasource", "clickhouse:9000"},
	// Business
	{p + "ds-pg-billing", "PostgreSQL Billing Database", "postgres", "postgres-billing:5432"},
	{p + "ds-pg-crm", "PostgreSQL CRM Database", "postgres", "postgres-crm:5432"},
	// Kafka
	{p + "ds-kafka-metrics", "Kafka Broker Metrics", "prometheus", "http://prometheus-kafka:9090"},
	// External APIs
	{p + "ds-json-weather", "Weather API (JSON)", "simpod-json-datasource", "http://weather-api:8080"},
	{p + "ds-csv-inventory", "Inventory CSV Feed", "marcusolsson-csv-datasource", "http://inventory:8080"},
	// Testing
	{p + "ds-testdata", "Test Data Generator", "grafana-testdata-datasource", ""},

	// Environment-specific datasources
	{p + "ds-prom-canary", "Prometheus Canary Environment", "prometheus", "http://prometheus-canary:9090"},
	{p + "ds-loki-canary", "Loki Canary Logs", "loki", "http://loki-canary:3100"},
	{p + "ds-tempo-canary", "Tempo Canary Traces", "tempo", "http://tempo-canary:3200"},
	{p + "ds-prom-perf", "Prometheus Performance Testing", "prometheus", "http://prometheus-perf:9090"},
	{p + "ds-influx-legacy", "InfluxDB Legacy System", "influxdb", "http://influxdb-legacy:8086"},
	{p + "ds-pg-events", "PostgreSQL Event Store", "postgres", "postgres-events:5432"},
	{p + "ds-redis-ds", "Redis Data Source", "redis-datasource", "redis:6379"},

	// ML & Data
	{p + "ds-pg-mlflow", "PostgreSQL MLflow Metadata", "postgres", "postgres-mlflow:5432"},
	{p + "ds-pg-airflow", "PostgreSQL Airflow Metadata", "postgres", "postgres-airflow:5432"},
	{p + "ds-prom-gpu", "Prometheus GPU Metrics (DCGM)", "prometheus", "http://prometheus-gpu:9090"},

	// Compliance & FinOps
	{p + "ds-pg-compliance", "PostgreSQL Compliance Database", "postgres", "postgres-compliance:5432"},
	{p + "ds-cloudwatch-billing", "AWS CloudWatch Billing", "cloudwatch", ""},
	{p + "ds-bigquery", "BigQuery Cost Analysis", "grafana-bigquery-datasource", ""},

	// More specialized
	{p + "ds-es-cdn", "Elasticsearch CDN Logs", "elasticsearch", "http://es-cdn:9200"},
	{p + "ds-prom-network", "Prometheus Network Devices", "prometheus", "http://prometheus-snmp:9090"},
	{p + "ds-pg-ecommerce", "PostgreSQL E-Commerce", "postgres", "postgres-ecommerce:5432"},
	{p + "ds-prom-iot", "Prometheus IoT Gateway", "prometheus", "http://prometheus-iot:9090"},

	// Additional environments
	{p + "ds-prom-dr", "Prometheus Disaster Recovery", "prometheus", "http://prometheus-dr:9090"},
	{p + "ds-loki-dr", "Loki Disaster Recovery Logs", "loki", "http://loki-dr:3100"},
	{p + "ds-es-audit", "Elasticsearch Audit Trail", "elasticsearch", "http://es-audit:9200"},
	{p + "ds-prom-edge-1", "Prometheus Edge Site Alpha", "prometheus", "http://prometheus-edge-a:9090"},
	{p + "ds-prom-edge-2", "Prometheus Edge Site Bravo", "prometheus", "http://prometheus-edge-b:9090"},
	{p + "ds-loki-iot", "Loki IoT Device Logs", "loki", "http://loki-iot:3100"},
	{p + "ds-pg-auth", "PostgreSQL Authentication Service", "postgres", "postgres-auth:5432"},
	{p + "ds-mongo-sessions", "MongoDB Session Store", "mongodb", "mongodb-sessions:27017"},
	{p + "ds-prom-ci", "Prometheus CI/CD Metrics", "prometheus", "http://prometheus-ci:9090"},

	// Additional cloud & SaaS
	{p + "ds-datadog-bridge", "Datadog Metrics Bridge", "prometheus", "http://dd-bridge:9090"},
	{p + "ds-pagerduty", "PagerDuty Incident Data", "simpod-json-datasource", "http://pd-bridge:8080"},
	{p + "ds-jira-metrics", "Jira Ticket Metrics", "simpod-json-datasource", "http://jira-bridge:8080"},

	// More database variants
	{p + "ds-pg-geo", "PostgreSQL Geospatial Data", "postgres", "postgres-geo:5432"},
	{p + "ds-pg-timeseries", "TimescaleDB Time Series", "postgres", "timescaledb:5432"},
	{p + "ds-cassandra", "Cassandra Cluster", "hadesarchitect-cassandra-datasource", "cassandra:9042"},
	{p + "ds-dynamo-bridge", "DynamoDB Metrics Bridge", "prometheus", "http://dynamo-bridge:9090"},

	// Final batch to reach 100+
	{p + "ds-prom-gaming", "Prometheus Gaming Platform", "prometheus", "http://prometheus-gaming:9090"},
	{p + "ds-loki-mobile", "Loki Mobile App Logs", "loki", "http://loki-mobile:3100"},
	{p + "ds-pg-mobile", "PostgreSQL Mobile Analytics", "postgres", "postgres-mobile:5432"},
	{p + "ds-es-frontend", "Elasticsearch Frontend Errors", "elasticsearch", "http://es-frontend:9200"},
	{p + "ds-prom-finops", "Prometheus FinOps Exporter", "prometheus", "http://prometheus-finops:9090"},
	{p + "ds-pg-feature-flags", "PostgreSQL Feature Flag Service", "postgres", "postgres-flags:5432"},
	{p + "ds-influx-edge", "InfluxDB Edge Computing", "influxdb", "http://influxdb-edge:8086"},
	{p + "ds-loki-compliance", "Loki Compliance Logs", "loki", "http://loki-compliance:3100"},
	{p + "ds-prom-chaos", "Prometheus Chaos Engineering", "prometheus", "http://prometheus-chaos:9090"},
	{p + "ds-es-search", "Elasticsearch Site Search Analytics", "elasticsearch", "http://es-search:9200"},
}

var allPlaylists []playlist
var allAlertRules []alertRule
var allTeams []team
var allAnnotations []annotation
var allLibraryPanels []libraryPanel

func init() {
	// Generate playlists
	playlistDefs := []struct{ uid, name, interval string }{
		{"infra-rotation", "Infrastructure NOC Rotation", "30s"},
		{"k8s-oncall", "Kubernetes On-Call Screens", "1m"},
		{"db-health", "Database Health Rotation", "45s"},
		{"app-perf", "Application Performance Rotation", "30s"},
		{"frontend-vitals", "Frontend Web Vitals Rotation", "1m"},
		{"mobile-health", "Mobile App Health Screens", "1m"},
		{"business-kpis", "Business KPI Executive View", "2m"},
		{"revenue-finance", "Revenue and Finance Screens", "2m"},
		{"ecommerce-live", "E-Commerce Live Dashboard", "30s"},
		{"network-noc", "Network NOC Screens", "30s"},
		{"security-soc", "Security SOC Rotation", "45s"},
		{"cicd-pipeline", "CI/CD Pipeline Status", "1m"},
		{"finops-daily", "FinOps Daily Review", "2m"},
		{"sre-slo", "SRE SLO Status Screens", "1m"},
		{"incident-war", "Incident War Room Screens", "30s"},
		{"ml-training", "ML Training Monitor Screens", "2m"},
		{"ml-inference", "ML Inference Health", "1m"},
		{"kafka-streaming", "Kafka Streaming Status", "30s"},
		{"mq-health", "Message Queue Health Rotation", "45s"},
		{"iot-fleet", "IoT Fleet Status Screens", "1m"},
		{"obs-platform", "Observability Platform Health", "45s"},
		{"data-pipeline", "Data Pipeline Status Screens", "1m"},
		{"compliance-weekly", "Compliance Weekly Review", "5m"},
		{"exec-summary", "Executive Summary Rotation", "3m"},
		{"dev-team-daily", "Dev Team Daily Standup Screens", "1m"},
		{"staging-env", "Staging Environment Overview", "30s"},
		{"canary-deploy", "Canary Deployment Watch", "15s"},
		{"capacity-plan", "Capacity Planning Review", "5m"},
		{"cost-review", "Cost Review Weekly", "3m"},
		{"customer-health", "Customer Health Scores", "2m"},
		// Per-team rotations
		{"team-platform", "Platform Team Dashboard Rotation", "1m"},
		{"team-backend", "Backend Team Rotation", "1m"},
		{"team-frontend-r", "Frontend Team Rotation", "1m"},
		{"team-data-eng", "Data Engineering Rotation", "1m"},
		{"team-ml-eng", "ML Engineering Rotation", "2m"},
		{"team-sre-r", "SRE Team Rotation", "30s"},
		{"team-security-r", "Security Team Rotation", "45s"},
		{"team-mobile-r", "Mobile Team Rotation", "1m"},
		{"team-devex", "Developer Experience Rotation", "1m"},
		{"team-qa", "QA Team Test Results Rotation", "1m"},
		// Incident-specific
		{"incident-db", "Database Incident Response Screens", "30s"},
		{"incident-net", "Network Incident Response Screens", "30s"},
		{"incident-app", "Application Incident Response Screens", "30s"},
		{"incident-k8s", "Kubernetes Incident Response Screens", "30s"},
		{"incident-sec", "Security Incident Response Screens", "30s"},
		// Regional
		{"region-us", "US Region Overview", "1m"},
		{"region-eu", "EU Region Overview", "1m"},
		{"region-ap", "Asia Pacific Region Overview", "1m"},
		{"region-global", "Global Multi-Region Overview", "2m"},
		// Demos
		{"demo-exec", "Executive Demo Walkthrough", "5m"},
		{"demo-tech", "Technical Demo Walkthrough", "3m"},
		{"demo-sales", "Sales Demo Rotation", "2m"},
		// Monitoring
		{"golden-signals", "Golden Signals All Services", "30s"},
		{"red-metrics", "RED Metrics All APIs", "30s"},
		{"use-metrics", "USE Metrics All Infrastructure", "1m"},
		// Time-based
		{"morning-standup", "Morning Standup Screens", "1m"},
		{"evening-handoff", "Evening Shift Handoff", "1m"},
		{"weekend-oncall", "Weekend On-Call Minimal Set", "2m"},
		// Leadership
		{"cto-review", "CTO Weekly Review Screens", "3m"},
		{"vp-eng-review", "VP Engineering Monthly Review", "5m"},
		{"board-metrics", "Board Meeting Metrics", "5m"},
		// Additional
		{"perf-testing", "Performance Test Results", "1m"},
		{"load-test-live", "Load Test Live Monitor", "15s"},
		{"migration-status", "Migration Progress Tracker", "2m"},
		{"postmortem-review", "Postmortem Review Screens", "5m"},
		{"sprint-metrics", "Sprint Metrics Rotation", "2m"},
		{"quarterly-okrs", "Quarterly OKR Progress", "5m"},
		{"vendor-health", "Third-Party Vendor Health", "1m"},
		{"api-partner", "Partner API Health Status", "1m"},
		{"uptime-external", "External Uptime Status Screens", "30s"},
		{"gpu-cluster", "GPU Cluster Monitor", "30s"},
		{"edge-sites", "Edge Site Health Rotation", "1m"},
		{"iot-sensors-r", "IoT Sensor Feed Rotation", "30s"},
		{"audit-trail", "Audit Trail Review Screens", "5m"},
		{"compliance-dash", "Compliance Dashboard Rotation", "3m"},
		// Customer-facing
		{"status-page-internal", "Internal Status Page Screens", "30s"},
		{"status-page-external", "External Status Page Screens", "1m"},
		{"customer-onboard", "Customer Onboarding Screens", "2m"},
		{"support-queue", "Support Queue Monitor", "30s"},
		{"tier1-support", "Tier 1 Support Rotation", "1m"},
		{"escalation-queue", "Escalation Queue Monitor", "30s"},
		// Data
		{"data-quality-r", "Data Quality Rotation", "2m"},
		{"etl-status", "ETL Job Status Rotation", "1m"},
		{"warehouse-perf-r", "Warehouse Performance Rotation", "2m"},
		// Cache & messaging
		{"redis-cluster-r", "Redis Cluster Health Rotation", "30s"},
		{"kafka-cluster-r", "Kafka Cluster Health Rotation", "30s"},
		// Cost
		{"aws-cost-daily", "AWS Daily Cost Rotation", "3m"},
		{"multi-cloud-cost", "Multi-Cloud Cost Rotation", "3m"},
		// Release
		{"release-train", "Release Train Status", "2m"},
		{"hotfix-monitor", "Hotfix Deployment Monitor", "30s"},
		{"dark-launch", "Dark Launch Feature Monitor", "1m"},
		// Environment
		{"prod-health", "Production Health Summary", "30s"},
		{"staging-health", "Staging Health Summary", "1m"},
		{"dev-sandbox", "Dev Sandbox Status", "2m"},
		{"preview-envs", "Preview Environment Status", "1m"},
	}
	for _, pl := range playlistDefs {
		allPlaylists = append(allPlaylists, playlist{p + "pl-" + pl.uid, pl.name, pl.interval})
	}

	// Generate alert rules
	type alertDef struct{ uid, title, folder, group string }
	alertDefs := []alertDef{
		// Infrastructure
		{"cpu-high", "CPU usage above 90% for 5 minutes", p + "infra-compute", "infra-compute"},
		{"cpu-steal", "CPU steal time exceeding 10% indicating noisy neighbor", p + "infra-compute", "infra-compute"},
		{"mem-high", "Memory usage exceeding 85% threshold", p + "infra-compute", "infra-compute"},
		{"mem-oom", "OOM killer activated on host", p + "infra-compute", "infra-compute"},
		{"swap-active", "Swap usage detected indicating memory pressure", p + "infra-compute", "infra-compute"},
		{"load-high", "System load average exceeding CPU core count", p + "infra-compute", "infra-compute"},
		{"disk-low", "Disk space below 10% free", p + "infra-storage", "infra-storage"},
		{"disk-iops", "Disk IOPS exceeding provisioned capacity", p + "infra-storage", "infra-storage"},
		{"disk-latency", "Disk I/O latency above 50ms", p + "infra-storage", "infra-storage"},
		{"nfs-stale", "NFS stale file handle errors detected", p + "infra-storage", "infra-storage"},
		{"ntp-drift", "NTP clock drift exceeding 100ms", p + "infra-os", "infra-os"},
		{"systemd-fail", "Systemd service entered failed state", p + "infra-os", "infra-os"},
		{"temp-high", "Server temperature exceeding 80°C", p + "infra-hw", "infra-hardware"},
		{"fan-fail", "Chassis fan failure detected", p + "infra-hw", "infra-hardware"},
		{"ups-battery", "UPS on battery power", p + "infra-hw", "infra-hardware"},
		// Kubernetes
		{"pod-crashloop", "Pod CrashLoopBackOff detected", p + "k8s-workloads", "k8s-workloads"},
		{"pod-pending", "Pod stuck in Pending state for over 10 minutes", p + "k8s-workloads", "k8s-workloads"},
		{"pod-oom", "Container OOM killed", p + "k8s-workloads", "k8s-workloads"},
		{"deploy-stalled", "Deployment rollout stalled", p + "k8s-workloads", "k8s-workloads"},
		{"hpa-maxed", "HPA at maximum replicas", p + "k8s-workloads", "k8s-workloads"},
		{"node-notready", "Kubernetes node NotReady", p + "k8s-cluster", "k8s-cluster"},
		{"node-pressure", "Node disk or memory pressure detected", p + "k8s-cluster", "k8s-cluster"},
		{"etcd-latency", "etcd request latency above 200ms", p + "k8s-cluster", "k8s-cluster"},
		{"pvc-full", "PersistentVolumeClaim usage above 90%", p + "k8s-cluster", "k8s-cluster"},
		{"ingress-5xx", "Ingress returning 5xx error rate above 1%", p + "k8s-networking", "k8s-networking"},
		// Databases
		{"pg-repl-lag", "PostgreSQL replication lag exceeding 30 seconds", p + "db-sql", "db-sql"},
		{"pg-conn-high", "PostgreSQL connections above 80% of max", p + "db-sql", "db-sql"},
		{"pg-deadlock", "PostgreSQL deadlocks detected", p + "db-sql", "db-sql"},
		{"pg-slow-query", "PostgreSQL queries exceeding 10 second duration", p + "db-sql", "db-sql"},
		{"mysql-repl-lag", "MySQL replication seconds behind master above 60", p + "db-sql", "db-sql"},
		{"mysql-conn-high", "MySQL too many connections approaching limit", p + "db-sql", "db-sql"},
		{"mongo-repl-lag", "MongoDB replication oplog window below 1 hour", p + "db-nosql", "db-nosql"},
		{"cassandra-hints", "Cassandra stored hints accumulating", p + "db-nosql", "db-nosql"},
		{"dynamo-throttle", "DynamoDB throttled requests detected", p + "db-nosql", "db-nosql"},
		{"redis-mem-high", "Redis memory usage above 80% of maxmemory", p + "cache", "cache"},
		{"redis-evictions", "Redis eviction rate spike detected", p + "cache", "cache"},
		// Application
		{"http-5xx", "HTTP 5xx error rate exceeding 1% of traffic", p + "app-api", "app-api"},
		{"http-latency", "API response latency p99 above 2 seconds", p + "app-api", "app-api"},
		{"grpc-errors", "gRPC error rate above 5%", p + "app-api", "app-api"},
		{"circuit-open", "Circuit breaker opened for downstream service", p + "app-api", "app-api"},
		{"ws-disconnect", "WebSocket abnormal disconnect rate above 10%", p + "app-api", "app-api"},
		{"cwv-poor", "Core Web Vitals LCP above 2.5 seconds", p + "app-frontend", "app-frontend"},
		{"js-error-spike", "JavaScript error rate spike detected", p + "app-frontend", "app-frontend"},
		{"mobile-crash", "Mobile app crash rate above 1%", p + "app-mobile", "app-mobile"},
		{"mobile-anr-high", "Android ANR rate above 0.5%", p + "app-mobile", "app-mobile"},
		// Business
		{"payment-fail", "Payment failure rate above 5%", p + "biz-revenue", "biz-revenue"},
		{"churn-spike", "Daily churn rate above 2x historical average", p + "biz-revenue", "biz-revenue"},
		{"checkout-drop", "Checkout abandonment rate above 80%", p + "ecom", "ecommerce"},
		{"fraud-spike", "Fraud score anomaly detected", p + "ecom", "ecommerce"},
		{"inventory-low", "Product inventory below reorder threshold", p + "ecom", "ecommerce"},
		// Network
		{"packet-loss", "Network packet loss above 1%", p + "net", "network"},
		{"vpn-down", "VPN tunnel state changed to down", p + "net", "network"},
		{"bgp-flap", "BGP route flapping detected", p + "net", "network"},
		{"dns-failure", "DNS resolution failure rate above 5%", p + "net-dns", "network-dns"},
		{"lb-unhealthy", "Load balancer backend health check failures", p + "net-lb", "network-lb"},
		{"cert-expiry", "TLS certificate expiring within 14 days", p + "sec", "security"},
		{"waf-spike", "WAF block rate spike indicating possible attack", p + "sec", "security"},
		{"bruteforce", "Brute force login attempt pattern detected", p + "sec-audit", "security-audit"},
		// CI/CD
		{"build-fail", "Build failure rate above 20% in last hour", p + "cicd-builds", "cicd-builds"},
		{"deploy-fail", "Production deployment failure", p + "cicd-deploy", "cicd-deploy"},
		{"gitops-drift", "GitOps sync drift detected for over 30 minutes", p + "cicd-deploy", "cicd-deploy"},
		// FinOps
		{"cost-anomaly", "Cloud cost anomaly detected exceeding 20% of forecast", p + "finops", "finops"},
		{"budget-exceed", "Monthly cloud budget exceeded 90%", p + "finops", "finops"},
		{"idle-resource", "Idle compute resources detected for over 7 days", p + "finops", "finops"},
		// SRE
		{"slo-breach", "SLO error budget exhausted", p + "sre-slo", "sre-slo"},
		{"burn-rate-fast", "SLO fast burn rate alert triggered", p + "sre-slo", "sre-slo"},
		{"burn-rate-slow", "SLO slow burn rate alert triggered", p + "sre-slo", "sre-slo"},
		{"mttr-high", "MTTR exceeding 4 hour target", p + "sre-incidents", "sre-incidents"},
		{"oncall-fatigue", "On-call responder received 10+ pages in shift", p + "sre-incidents", "sre-incidents"},
		// ML
		{"model-drift", "ML model prediction accuracy dropped below threshold", p + "ml-inference", "ml-inference"},
		{"feature-drift", "ML feature distribution shift detected", p + "ml-inference", "ml-inference"},
		{"gpu-temp", "GPU temperature above 85°C", p + "ml-training", "ml-training"},
		{"training-fail", "ML training job failed", p + "ml-training", "ml-training"},
		// Message Queues
		{"kafka-lag", "Kafka consumer lag exceeding 10000 messages", p + "mq", "messaging"},
		{"kafka-partition", "Kafka under-replicated partitions detected", p + "mq", "messaging"},
		{"rabbitmq-queue", "RabbitMQ queue depth above 50000 messages", p + "mq", "messaging"},
		{"dlq-growing", "Dead letter queue growing above threshold", p + "mq", "messaging"},
		// IoT
		{"device-offline", "IoT device fleet offline percentage above 5%", p + "iot", "iot"},
		{"sensor-anomaly", "Sensor reading anomaly detected", p + "iot", "iot"},
		{"ota-failure", "Firmware OTA update failure rate above 10%", p + "iot", "iot"},
		// Observability
		{"prom-target-down", "Prometheus scrape target down", p + "obs", "observability"},
		{"loki-ingestion", "Loki ingestion rate dropped by 50%", p + "obs", "observability"},
		{"alertmanager-fail", "Alertmanager notification delivery failure", p + "obs", "observability"},
		// Data Engineering
		{"etl-fail", "ETL pipeline job failure", p + "data", "data-engineering"},
		{"data-stale", "Data freshness SLA breach detected", p + "data", "data-engineering"},
		{"dbt-fail", "dbt model build failure", p + "data", "data-engineering"},
		// Compliance
		{"gdpr-sla", "GDPR data request approaching SLA deadline", p + "gov", "compliance"},
		{"access-review", "Access review overdue by 30 days", p + "gov", "compliance"},
		{"retention-overdue", "Data retention purge job overdue", p + "gov", "compliance"},
		// Additional to reach 100+
		{"api-rate-limit", "API rate limit threshold reached for tenant", p + "app-api", "app-api"},
		{"graphql-complex", "GraphQL query complexity score above limit", p + "app-api", "app-api"},
		{"s3-cost", "S3 bucket storage cost growth above 30% month-over-month", p + "finops-aws", "finops-aws"},
		{"cdn-origin", "CDN origin error rate above 5%", p + "cache", "cache"},
		{"dns-propagation", "DNS change propagation delayed beyond 1 hour", p + "net-dns", "network-dns"},
	}
	for _, a := range alertDefs {
		allAlertRules = append(allAlertRules, alertRule{p + "alert-" + a.uid, a.title, a.folder, a.group})
	}

	// Generate teams
	teamNames := []string{
		"Platform Engineering", "Backend Services", "Frontend Web", "Mobile iOS", "Mobile Android",
		"SRE - Core", "SRE - Data", "SRE - Edge", "Security Operations (SecOps)", "Security Engineering",
		"Data Engineering", "Data Science", "ML Platform", "ML Applied", "DevOps Tooling",
		"Infrastructure - Compute", "Infrastructure - Network", "Infrastructure - Storage",
		"Database Reliability", "API Platform",
		"Observability & Monitoring", "Incident Response", "Chaos Engineering",
		"FinOps & Cloud Optimization", "Developer Experience",
		"QA & Test Automation", "Release Engineering", "Performance Engineering",
		"Kubernetes Platform", "Service Mesh Team",
		"E-Commerce Platform", "Payment Systems", "Fraud Prevention",
		"Customer Success Engineering", "Support Engineering",
		"Product Analytics", "Growth Engineering", "Experimentation Platform",
		"Identity & Access Management", "Compliance Engineering",
		"IoT Platform", "Edge Computing", "Firmware Engineering",
		"Real-Time Streaming", "Event Processing",
		"Search & Recommendation", "Content Delivery",
		"Internal Tools", "Documentation Engineering",
		"Open Source Program Office",
		// Regional teams
		"SRE US-East", "SRE EU-West", "SRE AP-Southeast",
		"NOC US", "NOC EU", "NOC APAC",
		"Backend - Payments", "Backend - User Auth", "Backend - Notifications",
		"Backend - Search", "Backend - Feed", "Backend - Messaging",
		"Frontend - Dashboard", "Frontend - Checkout", "Frontend - Admin",
		"Data - Warehouse", "Data - Analytics", "Data - Streaming",
		"ML - NLP", "ML - Computer Vision", "ML - Recommendations",
		"Infra - AWS", "Infra - GCP", "Infra - Bare Metal",
		"QA - Integration", "QA - Performance", "QA - Security",
		// On-call rotations (as teams)
		"On-Call Primary", "On-Call Secondary", "On-Call Escalation",
		"On-Call Database", "On-Call Network", "On-Call Kubernetes",
		"On-Call Security", "On-Call Data Pipeline",
		// Management
		"Engineering Leadership", "Technical Program Management",
		"Architecture Review Board", "Change Advisory Board",
		// Cross-functional
		"Revenue Reliability", "Supply Chain Tech", "Partner Integrations",
		"Mobile Backend", "GraphQL Guild", "Rust Guild",
		"Accessibility", "Internationalization",
		"Cost Optimization Task Force", "Zero Trust Security Initiative",
		"Cloud Migration Team", "Legacy Modernization",
		"API Governance", "Data Governance",
		"Privacy Engineering", "Sustainability Engineering",
		"AI/ML Ethics Review", "Capacity Planning",
		"Disaster Recovery", "Business Continuity",
	}
	for _, name := range teamNames {
		allTeams = append(allTeams, team{name})
	}

	// Generate annotations (events)
	now := time.Now()
	type annDef struct {
		text         string
		dashboardUID string
		tags         []string
	}
	annDefs := []annDef{
		{"Deployed api-gateway v2.14.0 to production", "", []string{"deployment", "api-gateway", "production"}},
		{"Deployed user-service v3.8.2 to production", "", []string{"deployment", "user-service", "production"}},
		{"Deployed payment-service v1.22.0 to production", "", []string{"deployment", "payment-service", "production"}},
		{"Deployed frontend v5.1.0 to production", "", []string{"deployment", "frontend", "production"}},
		{"Deployed mobile-api v2.5.1 to production", "", []string{"deployment", "mobile-api", "production"}},
		{"Deployed search-service v4.0.0 to production", "", []string{"deployment", "search-service", "production"}},
		{"Deployed notification-service v1.15.0 to production", "", []string{"deployment", "notification-service", "production"}},
		{"Deployed ml-inference v2.3.0 to production with new model weights", "", []string{"deployment", "ml-inference", "production"}},
		{"Deployed grafana-agent v0.38.0 across all clusters", "", []string{"deployment", "grafana-agent", "infrastructure"}},
		{"Rolled back checkout-service v3.2.0 to v3.1.9 due to increased errors", "", []string{"rollback", "checkout-service", "production"}},
		{"Rolled back recommendation-engine v1.8.0 due to accuracy regression", "", []string{"rollback", "ml", "production"}},
		{"INCIDENT: Elevated 5xx errors on checkout API (SEV-1)", "", []string{"incident", "sev1", "checkout"}},
		{"INCIDENT: Database primary failover triggered (SEV-1)", "", []string{"incident", "sev1", "database"}},
		{"INCIDENT: Kafka cluster broker 3 unreachable (SEV-2)", "", []string{"incident", "sev2", "kafka"}},
		{"INCIDENT: CDN origin errors causing slow page loads (SEV-2)", "", []string{"incident", "sev2", "cdn"}},
		{"INCIDENT: DNS resolver timeout affecting US-East (SEV-2)", "", []string{"incident", "sev2", "dns"}},
		{"INCIDENT: Memory leak in user-service causing OOM kills (SEV-2)", "", []string{"incident", "sev2", "memory"}},
		{"INCIDENT: SSL certificate expired on partner API gateway (SEV-3)", "", []string{"incident", "sev3", "ssl"}},
		{"INCIDENT: Elevated latency on GraphQL endpoint (SEV-3)", "", []string{"incident", "sev3", "graphql"}},
		{"INCIDENT RESOLVED: Checkout API 5xx errors resolved after rollback", "", []string{"resolved", "incident", "checkout"}},
		{"INCIDENT RESOLVED: Database failover completed successfully", "", []string{"resolved", "incident", "database"}},
		{"INCIDENT RESOLVED: Kafka broker 3 back online after restart", "", []string{"resolved", "incident", "kafka"}},
		{"Scheduled maintenance: PostgreSQL primary vacuum and reindex", "", []string{"maintenance", "postgresql", "scheduled"}},
		{"Scheduled maintenance: Kubernetes cluster upgrade to v1.29", "", []string{"maintenance", "kubernetes", "upgrade"}},
		{"Scheduled maintenance: Network switch firmware upgrade in rack 12", "", []string{"maintenance", "network", "firmware"}},
		{"Scheduled maintenance: Redis cluster resharding", "", []string{"maintenance", "redis", "resharding"}},
		{"Scheduled maintenance: Prometheus TSDB compaction window", "", []string{"maintenance", "prometheus", "compaction"}},
		{"Scheduled maintenance: InfluxDB retention policy enforcement", "", []string{"maintenance", "influxdb", "retention"}},
		{"Feature flag enabled: new-checkout-flow for 10% of users", "", []string{"feature-flag", "checkout", "experiment"}},
		{"Feature flag enabled: ai-recommendations for premium tier", "", []string{"feature-flag", "recommendations", "ai"}},
		{"Feature flag disabled: dark-mode-v2 due to rendering bugs", "", []string{"feature-flag", "frontend", "disabled"}},
		{"A/B test started: pricing-page-v3 vs control", "", []string{"experiment", "abtesting", "pricing"}},
		{"A/B test concluded: signup-flow-simplified winner declared", "", []string{"experiment", "abtesting", "signup"}},
		{"Load test started: Black Friday simulation 10x normal traffic", "", []string{"loadtest", "performance", "ecommerce"}},
		{"Load test completed: System handled 50k RPS with p99 < 500ms", "", []string{"loadtest", "performance", "results"}},
		{"Chaos experiment: Killed 30% of pods in payments namespace", "", []string{"chaos", "experiment", "payments"}},
		{"Chaos experiment: Injected 200ms latency on database connections", "", []string{"chaos", "experiment", "database"}},
		{"ML model retrained: fraud-detection-v4 with updated features", "", []string{"ml", "training", "fraud"}},
		{"ML model deployed: recommendation-engine-v2 to A/B test", "", []string{"ml", "deployment", "recommendations"}},
		{"ML model rollback: sentiment-analysis-v3 accuracy below threshold", "", []string{"ml", "rollback", "sentiment"}},
		{"Data pipeline: Full historical backfill started for analytics warehouse", "", []string{"data", "backfill", "warehouse"}},
		{"Data pipeline: Schema migration completed for events table", "", []string{"data", "migration", "schema"}},
		{"AWS: Reserved instances renewed for us-east-1 compute", "", []string{"aws", "finops", "reserved"}},
		{"AWS: Spot instance interruption wave in us-west-2", "", []string{"aws", "spot", "interruption"}},
		{"GCP: Preemptible VM batch terminated in ML training pool", "", []string{"gcp", "preemptible", "ml"}},
		{"Compliance: SOC2 audit period started", "", []string{"compliance", "soc2", "audit"}},
		{"Compliance: GDPR data deletion batch processed 1500 requests", "", []string{"compliance", "gdpr", "deletion"}},
		{"Compliance: PCI-DSS quarterly scan completed with 0 findings", "", []string{"compliance", "pcidss", "scan"}},
		{"IoT: Firmware v2.1.0 OTA rollout started for sensor fleet alpha", "", []string{"iot", "firmware", "ota"}},
		{"IoT: 15 edge gateways reconnected after network maintenance", "", []string{"iot", "edge", "reconnection"}},
		{"Security: Vulnerability scan completed across all container images", "", []string{"security", "vulnerability", "scan"}},
		{"Security: WAF rule update deployed to block new attack vector", "", []string{"security", "waf", "update"}},
		{"Security: Secrets rotation completed for all service accounts", "", []string{"security", "secrets", "rotation"}},
		{"Kubernetes: Cluster autoscaler added 5 nodes in us-east-1", "", []string{"kubernetes", "autoscaler", "scaleup"}},
		{"Kubernetes: PodDisruptionBudget prevented eviction during upgrade", "", []string{"kubernetes", "pdb", "upgrade"}},
		{"Network: BGP peering re-established with ISP-2 after maintenance", "", []string{"network", "bgp", "peering"}},
		{"Network: CDN cache purge completed for static assets", "", []string{"network", "cdn", "purge"}},
		{"Database: PostgreSQL auto-vacuum completed on orders table (2.1GB reclaimed)", "", []string{"database", "postgresql", "vacuum"}},
		{"Database: MySQL slow query log rotated (500MB archived)", "", []string{"database", "mysql", "maintenance"}},
		{"Cache: Redis memory optimization reduced usage by 15%", "", []string{"cache", "redis", "optimization"}},
		{"Monitoring: Alert silence applied for scheduled Kafka maintenance", "", []string{"monitoring", "silence", "kafka"}},
		{"Monitoring: New dashboard published for GPU cluster utilization", "", []string{"monitoring", "dashboard", "gpu"}},
		// Additional to reach 100+
		{"Deployed data-pipeline v2.0.0 with new Airflow DAGs", "", []string{"deployment", "data-pipeline", "airflow"}},
		{"Deployed auth-service v4.1.0 with MFA improvements", "", []string{"deployment", "auth-service", "security"}},
		{"INCIDENT: GPU cluster job scheduler hung (SEV-2)", "", []string{"incident", "sev2", "gpu"}},
		{"INCIDENT RESOLVED: GPU scheduler restarted, queue draining normally", "", []string{"resolved", "incident", "gpu"}},
		{"Deployed iot-gateway v1.5.0 with improved MQTT handling", "", []string{"deployment", "iot", "mqtt"}},
		{"Scheduled maintenance: MongoDB replica set rolling restart", "", []string{"maintenance", "mongodb", "restart"}},
		{"Feature flag enabled: real-time-notifications for all users", "", []string{"feature-flag", "notifications", "enabled"}},
		{"Data pipeline: dbt model refresh completed in 45 minutes", "", []string{"data", "dbt", "refresh"}},
		{"Chaos experiment: Network partition between US and EU regions", "", []string{"chaos", "experiment", "network"}},
		{"AWS: New savings plan activated covering 70% of EC2 usage", "", []string{"aws", "finops", "savings"}},
		{"Compliance: Annual penetration test started by external auditor", "", []string{"compliance", "pentest", "security"}},
		{"ML model: A/B test shows 12% improvement in click-through rate", "", []string{"ml", "abtesting", "results"}},
		{"Kubernetes: Istio service mesh upgraded to v1.20", "", []string{"kubernetes", "istio", "upgrade"}},
		{"Security: Emergency patch applied for CVE-2026-1234", "", []string{"security", "patch", "cve"}},
		{"Database: CockroachDB range rebalancing completed across zones", "", []string{"database", "cockroachdb", "rebalance"}},
		{"Load test: API gateway sustained 100k concurrent connections", "", []string{"loadtest", "apigateway", "connections"}},
		{"Deployed prometheus-operator v0.72.0 across all clusters", "", []string{"deployment", "prometheus", "operator"}},
		{"Network: New PoP activated in Singapore for APAC latency improvement", "", []string{"network", "pop", "apac"}},
		{"IoT: Sensor calibration batch completed for temperature fleet", "", []string{"iot", "calibration", "sensors"}},
		{"Deployed grafana v12.0.0 with unified storage enabled", "", []string{"deployment", "grafana", "upgrade"}},
	}
	for i, a := range annDefs {
		_ = now
		allAnnotations = append(allAnnotations, annotation{
			Text:         a.text,
			DashboardUID: a.dashboardUID,
			Tags:         a.tags,
		})
		_ = i
	}

	// Generate library panels
	lpDefs := []struct{ uid, name, folder string }{
		{"lp-golden-signals", "Golden Signals Panel", p + "sre"},
		{"lp-red-metrics", "RED Metrics Panel", p + "app"},
		{"lp-use-metrics", "USE Metrics Panel", p + "infra"},
		{"lp-slo-burn-rate", "SLO Burn Rate Widget", p + "sre-slo"},
		{"lp-error-budget", "Error Budget Remaining", p + "sre-slo"},
		{"lp-request-rate", "Request Rate Counter", p + "app-api"},
		{"lp-error-rate", "Error Rate Percentage", p + "app-api"},
		{"lp-latency-p99", "Latency P99 Gauge", p + "app-api"},
		{"lp-cpu-gauge", "CPU Usage Gauge", p + "infra-compute"},
		{"lp-mem-gauge", "Memory Usage Gauge", p + "infra-compute"},
		{"lp-disk-gauge", "Disk Usage Gauge", p + "infra-storage"},
		{"lp-net-traffic", "Network Traffic Graph", p + "net"},
		{"lp-pod-status", "Pod Status Overview", p + "k8s-workloads"},
		{"lp-node-status", "Node Status Grid", p + "k8s-cluster"},
		{"lp-deploy-status", "Deployment Status", p + "k8s-workloads"},
		{"lp-db-connections", "Database Connection Pool", p + "db"},
		{"lp-cache-hit-rate", "Cache Hit Rate", p + "cache"},
		{"lp-queue-depth", "Message Queue Depth", p + "mq"},
		{"lp-consumer-lag", "Consumer Lag Monitor", p + "mq"},
		{"lp-build-status", "CI Build Status", p + "cicd-builds"},
		{"lp-deploy-freq-w", "Deployment Frequency Widget", p + "cicd-deploy"},
		{"lp-dora-summary", "DORA Metrics Summary", p + "cicd"},
		{"lp-cost-trend", "Cloud Cost Trend", p + "finops"},
		{"lp-cost-by-team", "Cost by Team Breakdown", p + "finops"},
		{"lp-mrr-counter", "MRR Counter Widget", p + "biz-revenue"},
		{"lp-churn-rate-w", "Churn Rate Widget", p + "biz-revenue"},
		{"lp-dau-counter", "Daily Active Users Counter", p + "biz-product"},
		{"lp-conversion-funnel", "Conversion Funnel", p + "biz-product"},
		{"lp-nps-gauge", "NPS Score Gauge", p + "biz-product"},
		{"lp-incident-count", "Active Incidents Counter", p + "sre-incidents"},
		{"lp-mttr-avg", "Average MTTR Widget", p + "sre-incidents"},
		{"lp-oncall-pager", "On-Call Pager Counter", p + "sre-incidents"},
		{"lp-cert-expiry", "TLS Certificate Expiry Countdown", p + "sec"},
		{"lp-vuln-count", "Vulnerability Count by Severity", p + "sec-vuln"},
		{"lp-audit-events", "Recent Audit Events", p + "sec-audit"},
		{"lp-kafka-lag-w", "Kafka Consumer Lag Widget", p + "mq"},
		{"lp-gpu-util-w", "GPU Utilization Widget", p + "ml-training"},
		{"lp-model-accuracy-w", "Model Accuracy Gauge", p + "ml-inference"},
		{"lp-iot-online", "IoT Devices Online Counter", p + "iot"},
		{"lp-sensor-reading", "Sensor Reading Sparkline", p + "iot"},
		{"lp-etl-status-w", "ETL Job Status Widget", p + "data"},
		{"lp-data-freshness-w", "Data Freshness Indicator", p + "data"},
		{"lp-uptime-sla", "Uptime SLA Percentage", p + "sre-slo"},
		{"lp-availability", "Service Availability Gauge", p + "sre"},
		{"lp-throughput", "Request Throughput Counter", p + "app-api"},
		{"lp-saturation", "Resource Saturation Gauge", p + "infra"},
		{"lp-payment-success", "Payment Success Rate", p + "ecom"},
		{"lp-cart-abandonment", "Cart Abandonment Rate", p + "ecom"},
		{"lp-shipping-eta", "Shipping ETA Tracker", p + "ecom"},
		{"lp-fraud-score", "Fraud Score Distribution", p + "ecom"},
		{"lp-mobile-crashes-w", "Mobile Crash Rate Widget", p + "app-mobile"},
		{"lp-cwv-scores", "Core Web Vitals Scores", p + "app-frontend"},
		{"lp-dns-latency", "DNS Resolution Latency", p + "net-dns"},
		{"lp-bgp-peers", "BGP Peer Status", p + "net"},
		{"lp-firewall-blocks", "Firewall Blocked Traffic", p + "net"},
		{"lp-vpn-status", "VPN Tunnel Status", p + "net"},
		{"lp-compliance-score", "Compliance Score Gauge", p + "gov"},
		{"lp-gdpr-requests-w", "GDPR Request Queue", p + "gov"},
		{"lp-change-failure-w", "Change Failure Rate Widget", p + "cicd-deploy"},
		{"lp-lead-time-w", "Lead Time for Changes", p + "cicd-deploy"},
		{"lp-test-pass-rate", "Test Pass Rate Widget", p + "cicd-builds"},
		// Additional to reach 100+
		{"lp-aws-cost-gauge", "AWS Daily Cost Gauge", p + "finops-aws"},
		{"lp-gcp-cost-gauge", "GCP Daily Cost Gauge", p + "finops-gcp"},
		{"lp-spot-savings", "Spot Instance Savings", p + "finops-aws"},
		{"lp-ri-coverage", "Reserved Instance Coverage", p + "finops-aws"},
		{"lp-idle-resources", "Idle Resources Counter", p + "finops"},
		{"lp-rightsizing-opp", "Rightsizing Opportunities", p + "finops"},
		{"lp-training-loss", "ML Training Loss Curve", p + "ml-training"},
		{"lp-inference-qps", "Inference QPS Counter", p + "ml-inference"},
		{"lp-feature-drift-w", "Feature Drift Alert", p + "ml-inference"},
		{"lp-airflow-dag-w", "Airflow DAG Status", p + "data"},
		{"lp-dbt-model-w", "dbt Model Status", p + "data"},
		{"lp-warehouse-cost", "Warehouse Query Cost", p + "data"},
		{"lp-rbac-changes-w", "RBAC Changes Feed", p + "sec-audit"},
		{"lp-secrets-age", "Secrets Age Indicator", p + "sec"},
		{"lp-waf-events-w", "WAF Events Counter", p + "sec"},
		{"lp-ddos-traffic", "DDoS Traffic Monitor", p + "sec"},
		{"lp-battery-levels", "Device Battery Levels", p + "iot"},
		{"lp-firmware-version", "Firmware Version Distribution", p + "iot"},
		{"lp-edge-latency", "Edge Gateway Latency", p + "iot"},
		{"lp-prom-targets", "Prometheus Target Health", p + "obs"},
		{"lp-loki-volume", "Loki Log Volume", p + "obs"},
		{"lp-tempo-spans", "Tempo Spans per Second", p + "obs"},
		{"lp-grafana-users", "Grafana Active Users", p + "obs"},
		{"lp-session-duration", "User Session Duration", p + "app-frontend"},
		{"lp-bounce-rate", "Bounce Rate Widget", p + "app-frontend"},
		{"lp-signup-rate", "Signup Rate Counter", p + "biz-product"},
		{"lp-trial-conversion", "Trial to Paid Conversion", p + "biz-revenue"},
		{"lp-ab-test-winner", "A/B Test Winner Indicator", p + "biz-product"},
		{"lp-nfs-latency", "NFS Latency Monitor", p + "infra-storage"},
		{"lp-s3-size", "S3 Bucket Size Tracker", p + "infra-storage"},
		{"lp-haproxy-conn", "HAProxy Active Connections", p + "net-lb"},
		{"lp-rabbitmq-depth", "RabbitMQ Queue Depth", p + "mq"},
		{"lp-dlq-counter", "Dead Letter Queue Counter", p + "mq"},
		{"lp-nats-msgs", "NATS Message Rate", p + "mq"},
		{"lp-chaos-result", "Chaos Experiment Result", p + "sre"},
		{"lp-postmortem-actions", "Postmortem Actions Due", p + "sre-incidents"},
		{"lp-sprint-velocity", "Sprint Velocity Gauge", p + "cicd"},
		{"lp-pr-cycle-time", "PR Cycle Time", p + "cicd"},
		{"lp-code-coverage-w", "Code Coverage Percentage", p + "cicd-builds"},
	}
	for _, lp := range lpDefs {
		allLibraryPanels = append(allLibraryPanels, libraryPanel{p + lp.uid, lp.name, lp.folder})
	}
}

// --- Main ---

func main() {
	flag.Parse()
	if *cleanup {
		doCleanup()
	} else {
		doSeed()
	}
}

func doSeed() {
	fmt.Println("=== Seeding Grafana resources ===")

	fmt.Printf("\n--- Folders (%d) ---\n", len(allFolders))
	for _, f := range allFolders {
		post("/api/folders", map[string]any{"uid": f.UID, "title": f.Title, "description": f.Description})
	}

	fmt.Printf("\n--- Datasources (%d) ---\n", len(allDatasources))
	for _, ds := range allDatasources {
		post("/api/datasources", map[string]any{"uid": ds.UID, "name": ds.Name, "type": ds.Type, "url": ds.URL, "access": "proxy"})
	}

	fmt.Printf("\n--- Dashboards (%d) ---\n", len(allDashboards))
	for _, d := range allDashboards {
		post("/api/dashboards/db", map[string]any{
			"dashboard": map[string]any{
				"uid": d.UID, "title": d.Title, "description": d.Description, "tags": d.Tags,
				"panels": []map[string]any{{
					"id": 1, "type": "timeseries", "title": d.Title, "description": d.Description,
					"gridPos": map[string]any{"h": 8, "w": 24, "x": 0, "y": 0},
				}},
			},
			"folderUid": d.FolderUID, "overwrite": true,
		})
	}

	fmt.Printf("\n--- Playlists (%d) ---\n", len(allPlaylists))
	for _, pl := range allPlaylists {
		post("/api/playlists", map[string]any{"uid": pl.UID, "name": pl.Name, "interval": pl.Interval, "items": []map[string]any{}})
	}

	fmt.Printf("\n--- Alert Rules (%d) ---\n", len(allAlertRules))
	for _, a := range allAlertRules {
		post("/api/v1/provisioning/alert-rules", map[string]any{
			"uid": a.UID, "title": a.Title, "folderUID": a.FolderUID, "ruleGroup": a.RuleGroup,
			"condition": "A", "noDataState": "NoData", "execErrState": "Alerting", "for": "5m",
			"data": []map[string]any{{
				"refId": "A", "datasourceUid": "__expr__",
				"model": map[string]any{"expression": "1 == 1", "type": "math"},
			}},
		})
	}

	fmt.Printf("\n--- Teams (%d) ---\n", len(allTeams))
	for _, t := range allTeams {
		post("/api/teams", map[string]any{"name": t.Name})
	}

	fmt.Printf("\n--- Annotations (%d) ---\n", len(allAnnotations))
	now := time.Now()
	for i, a := range allAnnotations {
		body := map[string]any{
			"text": a.Text,
			"time": now.Add(-time.Duration(len(allAnnotations)-i) * 30 * time.Minute).UnixMilli(),
			"tags": a.Tags,
		}
		if a.DashboardUID != "" {
			body["dashboardUID"] = a.DashboardUID
		}
		post("/api/annotations", body)
	}

	fmt.Printf("\n--- Library Panels (%d) ---\n", len(allLibraryPanels))
	for _, lp := range allLibraryPanels {
		post("/api/library-elements", map[string]any{
			"uid": lp.UID, "name": lp.Name, "kind": 1, "folderUid": lp.FolderUID,
			"model": map[string]any{"type": "timeseries", "title": lp.Name},
		})
	}

	fmt.Printf("\n=== Done! Seeded %d folders, %d dashboards, %d datasources, %d playlists, %d alerts, %d teams, %d annotations, %d library panels ===\n",
		len(allFolders), len(allDashboards), len(allDatasources), len(allPlaylists), len(allAlertRules), len(allTeams), len(allAnnotations), len(allLibraryPanels))
	fmt.Printf("=== Total: %d resources ===\n",
		len(allFolders)+len(allDashboards)+len(allDatasources)+len(allPlaylists)+len(allAlertRules)+len(allTeams)+len(allAnnotations)+len(allLibraryPanels))
}

func doCleanup() {
	fmt.Println("=== Cleaning up seeded resources ===")

	fmt.Println("\n--- Alert Rules ---")
	for _, a := range allAlertRules {
		del("/api/v1/provisioning/alert-rules/" + a.UID)
	}
	fmt.Println("\n--- Playlists ---")
	for _, pl := range allPlaylists {
		del("/api/playlists/" + pl.UID)
	}
	fmt.Println("\n--- Library Panels ---")
	for _, lp := range allLibraryPanels {
		del("/api/library-elements/" + lp.UID)
	}
	fmt.Println("\n--- Dashboards ---")
	for _, d := range allDashboards {
		del("/api/dashboards/uid/" + d.UID)
	}
	fmt.Println("\n--- Datasources ---")
	for _, ds := range allDatasources {
		del("/api/datasources/uid/" + ds.UID)
	}
	fmt.Println("\n--- Folders ---")
	for _, f := range allFolders {
		del("/api/folders/" + f.UID)
	}
	// Note: teams and annotations don't have UID-based delete with our prefix pattern.
	fmt.Println("\n--- Teams and annotations must be cleaned up manually ---")
	fmt.Println("\n=== Cleanup complete ===")
}

func post(path string, body any) {
	data, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", *grafanaURL+path, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(*user, *pass)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("  ERROR %s: %v\n", path, err)
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	status := "OK"
	if resp.StatusCode >= 400 {
		status = fmt.Sprintf("FAIL: %s", truncate(string(respBody), 80))
	}

	name := extractName(body)
	fmt.Printf("  %-60s [%d] %s\n", truncate(name, 58), resp.StatusCode, status)
}

func del(path string) {
	req, _ := http.NewRequest("DELETE", *grafanaURL+path, nil)
	req.SetBasicAuth(*user, *pass)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("  ERROR %s: %v\n", path, err)
		return
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body)
	parts := strings.Split(path, "/")
	fmt.Printf("  %-60s [%d]\n", parts[len(parts)-1], resp.StatusCode)
}

func extractName(body any) string {
	if m, ok := body.(map[string]any); ok {
		for _, key := range []string{"title", "name", "text"} {
			if v, ok := m[key].(string); ok {
				return v
			}
		}
		if d, ok := m["dashboard"].(map[string]any); ok {
			if v, ok := d["title"].(string); ok {
				return v
			}
		}
	}
	return "?"
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
