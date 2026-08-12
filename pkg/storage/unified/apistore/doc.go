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
