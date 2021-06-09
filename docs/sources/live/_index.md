+++
title = "Grafana Live"
aliases = []
weight = 115
+++

# Grafana Live overview

Grafana Live is a real-time messaging engine introduced in Grafana v8.0.

With Grafana Live, you can push event data to a frontend as soon as an event occurs.

This could be notifications about dashboard changes, new frames for rendered data, and so on. Live features can help eliminate a page reload or polling in many places, it can stream Internet of things (IOT) sensors or any other real-time data to panels.

> **Note:** By `real-time`, we indicate a soft real-time. Due to network latencies, garbage collection cycles, and so on, the delay of a delivered message can be up to several hundred milliseconds or higher.
