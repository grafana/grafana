// Package pipeline defines a load pipeline for Grafana plugins.
//
// A pipeline is a sequence of stages that are executed in order. Each stage is made up of a series of steps.
// A plugin loader pipeline is defined by the following stages:
// 	 Discovery: Find plugins (e.g. from disk, remote, etc.), and [optionally] filter the results based on some criteria.
// 	 Bootstrap: Create the plugins found in the discovery stage and enrich them with metadata.
// 	 Verification: Verify the plugins based on some criteria (e.g. signature validation, angular detection, etc.)
// 	 Initialization: Initialize the plugin for use (e.g. register with Grafana, start the backend process, declare RBAC roles etc.)
// - Termination: Terminate the plugin (e.g. stop the backend process, cleanup, etc.)

package pipeline
