// Package pipeline defines a load pipeline for Grafana plugins.
//
// A pipeline is a sequence of stages that are executed in order. Each stage is made up of a series of steps.
// A plugin loader pipeline is defined by the following stages:
// 	 Discovery: Find plugins (e.g. from disk, remote, etc.), filter the results based on some criteria and construct the plugin base.
// 	 Verification: Verify the plugins (e.g. signature validation, angular detection, etc.)
// 	 Enrichment: Decorate the plugin with additional metadata (set image paths, aliasing, etc.)
// 	 Initialization: Initialize the plugin for use (e.g. register with Grafana, etc.)
// 	 Post-Initialization: Perform any post-initialization tasks (e.g. start the backend process, declare RBAC roles etc.)

package pipeline
