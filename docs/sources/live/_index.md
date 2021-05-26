+++
title = "Live"
aliases = []
weight = 115
+++

# Grafana Live overview

Grafana Live is a real-time messaging engine introduced in Grafana v8.

With Grafana Live it's possible to push event data to a frontend as soon as some event happened.

This could be notifications about dashboard changes, new frames for rendered data etc. Live features can help to eliminate a page reload or polling in many places, can be used to stream IOT sensor or any other real-time data to panels.

> When saying `real-time` in this doc we mean a soft real-time. Due to network latencies, garbage collection cycles etc. the delay of delivered message can be up to several hundred milliseconds or higher on practice.
