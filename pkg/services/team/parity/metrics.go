// Package parity provides a shadow comparator that, after each public legacy
// team write operation, reads back the resulting state via both the legacy
// SQL path and the K8s adapter path and compares them. The outcome is emitted
// as a Prometheus counter so adapter drift and silent dual-write failures show
// up as ongoing operational signal rather than only in tests.
//
// Design follows the `compareSearchResults` pattern in
// pkg/storage/unified/resource/search_client.go (background goroutine,
// context.WithoutCancel, separate timeout, no impact on the synchronous
// return path).
//
// Known limitation (v0). The comparator sits at the team-service layer,
// ABOVE the K8s API server's dual-writer. That means in dual-write Mode 1,
// reading via the K8s adapter still returns the legacy view (because the
// dual-writer reads from legacy in Mode 1). So:
//
//   - We CAN detect: adapter response-shape drift (e.g. id=0, memberCount=0,
//     external-member labels), missing legacy writes, partial-write states
//     where one path errored.
//   - We CANNOT detect: silent failures to write to unified storage in Mode 1
//     (the dual-writer's write-side fanout going wrong while reads come from
//     a still-correct legacy).
//
// True "did the write hit unified storage" verification needs a side channel
// below the dual-writer (direct unified-resource gRPC client, or a debug
// endpoint). That's a v1 extension.
package parity

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// teamParityCheckTotal counts parity-check outcomes. Labels:
//
//   - operation: "create" | "update" | "delete"
//   - mode:      dual-writer mode as a string ("0", "1", "5", "unknown")
//   - result:    "match" | "mismatch" | "legacy_error" | "k8s_error" |
//     "both_errors" | "missing_legacy" | "missing_k8s"
//
// "match"/"mismatch" are the dominant signal in healthy operation. A
// rising "mismatch" rate is the alertable condition; "*_error" rates above
// background noise are also actionable but distinct (typically point at the
// adapter rather than at storage divergence).
var teamParityCheckTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "grafana",
		Subsystem: "iam_team_parity",
		Name:      "check_total",
		Help:      "Counts shadow parity-check outcomes after each public legacy team write. See package doc for the v0 scope (catches adapter drift; does not directly observe Mode 1 unified-store writes).",
	},
	[]string{"operation", "mode", "result"},
)
