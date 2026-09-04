// Package kindstore serves a kind declared in an app-sdk manifest through
// unified storage.
//
// The kind is stored as an unstructured object and gets what apiextensions gives
// a custom resource of the same shape: its schema prunes, defaults and validates
// every write, its status is a subresource only its own endpoint can write, its
// admission capabilities are reviewed with the plugin, and its printer columns
// reach table output.
package kindstore
