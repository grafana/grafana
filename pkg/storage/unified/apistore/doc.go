// Package apistore provides an implementation of [k8s.io/apiserver/pkg/storage.Interface]
// that persists data into a [ResourceServer] (backend for unified storage)
//
// This package is responsible for running all the apiserver specific logic
// before and after sending requests to the StorageServer
//
// [StorageOptions] offers a way to configure the storage for each resource. For example,
// it's possible to set a [DefaultPermissionSetter], that will be used by [Storage.Create]
// to set default permissions for new resources.
//
// # Inline blob writes
//
// StorageOptions.EnableInlineBlobs opts a resource into write-only blobs.<name>.data
// handling. All entries are validated before uploading; uploads use the existing blob
// client (including its old-server fallback). Only server-issued references reach
// resource writes and their responses. Reference-only writes need no opt-in.
//
// This hook runs on the unified branch, without replacing the legacy writer's input.
// Before opting in, the resource must define the input in its schema and adapt its
// legacy writer. Kubernetes dry-run bypasses storage writes, so the resource's REST
// layer must also validate and redact inline data from dry-run responses without
// uploading it. Provisioning previews must retain their existing behavior.
//
// Blob uploads and resource writes are separate operations. Upload failures abort the
// resource write; failed resource writes (including retried updates) can leave orphan
// blobs. Eager deletion is unsafe after an ambiguous write outcome. Enabling blob GC
// requires a separate concurrent-GC/orphan-cleanup design.
//
// The idea is that [Storage] sits between the API Server and the [ResourceServer], with an
// optional DualWriter in front of it.
//
// Find below the simplied flow for a request to the API Server (with a DualWriter enabled) and where
// the [Storage] fits in:
//
//		            POST /apis/dashboards/v1/namespaces/default/dashboards
//					                          ↓
//					                      API Server
//					                          ↓
//					                      DualWriter
//					                    ↙             ↘
//		 (this package) apistore.Storage                LegacyStorage
//		 			            ↓                           ↓
//		 		  unified.ResourceClient                LegacyService (like folder.Service or dashboard.Service)
//					            ↓                           ↓
//	     StorageServer (unified storage)                SQL Storage
//
// [ResourceServer]: https://github.com/grafana/grafana/pkg/storage/unified/resource#ResourceServer
package apistore
