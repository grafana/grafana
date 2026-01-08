# Triage view

The triage view should serve several purposes and be a central place for users to manage their alert instances.

## Goals

- Observe the current state of their system
- Help correlate alerts with each other
- Be a launchpad for further investigation

## Non-goals

- Managing alert rules

## Technical goals

- Build re-usable components that can be used in other parts of Grafana and plugins
- These should be a mix of presentation components and data components
- Eventually most of this should live in the Grafana Alerting package
