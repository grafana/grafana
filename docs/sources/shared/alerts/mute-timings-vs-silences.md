---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: 'Mute and active timings vs silences'
---

The function of [Mute timing and active timing](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/) differs from [silences](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/), as they are two are distinct methods to suppress notifications. They do not prevent alert rules from being evaluated or stop alert instances from appearing in the user interface; they only prevent notifications from being created.

The following table highlights the key differences of mute timing and active timing compared with silences.

|            | Mute timing and active timing                               | Silence                                                          |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **Setup**  | Created and then added to notification policies             | Matches alerts using labels to determine whether to silence them |
| **Period** | Uses time interval definitions that can repeat periodically | Has a fixed start and end time                                   |

**When to use mute timings**

Use mute timing for predictable, recurring time periods when you don't want to receive notifications:

- Regular maintenance windows (for example, every Sunday from 2:00 AM to 4:00 AM)
- Non-business hours (for example, nights and weekends)
- Scheduled deployments or known change windows
- Regular testing periods

**When to use silences**

Use silences for one-time or as-needed suppression of notifications:

- Active incident response (suppress notifications while investigating)
- Immediate suppression of a specific alert or group of alerts
- One-time maintenance or deployment events
- Temporarily suppress alerts for specific services or components
