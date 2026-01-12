---
labels:
  products:
    - oss
title: 'Mute timings vs silences'
---

## Mute timings vs silences

[Mute timings](ref:shared-mute-timings) and [silences](ref:shared-silences) are distinct methods to suppress notifications. They do not prevent alert rules from being evaluated or stop alert instances from appearing in the user interface; they only prevent notifications from being created.

The following table highlights the key differences between mute timings and silences.

|            | Mute timing                                                 | Silence                                                          |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **Setup**  | Created and then added to notification policies             | Matches alerts using labels to determine whether to silence them |
| **Period** | Uses time interval definitions that can repeat periodically | Has a fixed start and end time                                   |

**When to use mute timings**

Use mute timings for predictable, recurring time periods when you don't want to receive notifications:

- Regular maintenance windows (for example, every Sunday from 2:00 AM to 4:00 AM)
- Non-business hours (for example, nights and weekends)
- Scheduled deployments or known change windows
- Regular testing periods

**When to use silences**

Use silences for one-time or ad-hoc suppression of notifications:

- Active incident response (suppress notifications while investigating)
- Immediate suppression of a specific alert or group of alerts
- One-time maintenance or deployment events
- Temporarily suppress alerts for specific services or components
