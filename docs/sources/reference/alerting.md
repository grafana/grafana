----
page_title: Alerting
page_description: Alerting
page_keywords: grafana, alerting
---

# Alerting

schedulers tick every second and schedule jobs for every tick.
jobs go into a queue (can be in-process or rabbitmq) and executors read from queue and execute.
Can have multiple schedulers for redundancy.  Workers supress jobs they've already executed.
Care must be taken to tune the various parameters, see configuration documentation.

Currently, scheduler schedules litmus-specific jobs. There is no general purpose scheduling or management yet,
though that's up next.
