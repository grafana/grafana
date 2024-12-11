---
labels:
  products:
    - oss
title: 'Mute timings vs silences'
---

## Silences vs mute timings

[Silences](ref:shared-silences) and [mute timings](ref:shared-mute-timings) do not prevent alert rules from being evaluated, nor do they stop alert instances from being shown in the user interface. They only prevent notifications from being created.

The following table highlights the key differences between mute timings and silences.

| Silence                                                                      | Mute timing                                        |
| ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Has a fixed start and end time                                               | Uses time interval definitions that can reoccur    |
| Uses labels to match against an alert to determine whether to silence or not | Is created and then added to notification policies |
