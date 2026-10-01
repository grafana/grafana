// Package kindstore serves a kind declared in an app-sdk manifest through
// unified storage.
//
// The kind is stored as an unstructured object. Its schema prunes, defaults and
// validates writes; status is writable only through its subresource; admission
// capabilities are reviewed with the plugin; and printer columns reach table
// output.
package kindstore
