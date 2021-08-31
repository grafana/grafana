+++
title = "Monitoring"
description = "Image rendering monitoring"
keywords = ["grafana", "image", "rendering", "plugin", "monitoring"]
weight = 300
+++

# Monitor image rendering

Rendering images can require a lot of memory, mainly because Grafana creates browser instances in the background for the actual rendering. Monitoring your service can help to allocate the right amount of resources to your rendering service and set the right configuration.

## Enable Prometheus metrics endpoint

The service can be configured to expose a Prometheus metrics endpoint. There's [dashboard](https://grafana.com/grafana/dashboards/12203) published that explains the details of how to configure and monitor the rendering service using Prometheus as a data source.

**Metrics endpoint output example:**

```
# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 0.536 1579444523566

# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds.
# TYPE process_cpu_system_seconds_total counter
process_cpu_system_seconds_total 0.064 1579444523566

# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 0.6000000000000001 1579444523566

# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.
# TYPE process_start_time_seconds gauge
process_start_time_seconds 1579444433

# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes 52686848 1579444523568

# HELP process_virtual_memory_bytes Virtual memory size in bytes.
# TYPE process_virtual_memory_bytes gauge
process_virtual_memory_bytes 2055344128 1579444523568

# HELP process_heap_bytes Process heap size in bytes.
# TYPE process_heap_bytes gauge
process_heap_bytes 1996390400 1579444523568

# HELP process_open_fds Number of open file descriptors.
# TYPE process_open_fds gauge
process_open_fds 31 1579444523567

# HELP process_max_fds Maximum number of open file descriptors.
# TYPE process_max_fds gauge
process_max_fds 1573877

# HELP nodejs_eventloop_lag_seconds Lag of event loop in seconds.
# TYPE nodejs_eventloop_lag_seconds gauge
nodejs_eventloop_lag_seconds 0.000915922 1579444523567

# HELP nodejs_active_handles Number of active libuv handles grouped by handle type. Every handle type is C++ class name.
# TYPE nodejs_active_handles gauge
nodejs_active_handles{type="WriteStream"} 2 1579444523566
nodejs_active_handles{type="Server"} 1 1579444523566
nodejs_active_handles{type="Socket"} 9 1579444523566
nodejs_active_handles{type="ChildProcess"} 2 1579444523566

# HELP nodejs_active_handles_total Total number of active handles.
# TYPE nodejs_active_handles_total gauge
nodejs_active_handles_total 14 1579444523567

# HELP nodejs_active_requests Number of active libuv requests grouped by request type. Every request type is C++ class name.
# TYPE nodejs_active_requests gauge
nodejs_active_requests{type="FSReqCallback"} 2

# HELP nodejs_active_requests_total Total number of active requests.
# TYPE nodejs_active_requests_total gauge
nodejs_active_requests_total 2 1579444523567

# HELP nodejs_heap_size_total_bytes Process heap size from node.js in bytes.
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes 13725696 1579444523567

# HELP nodejs_heap_size_used_bytes Process heap size used from node.js in bytes.
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes 12068008 1579444523567

# HELP nodejs_external_memory_bytes Nodejs external memory size in bytes.
# TYPE nodejs_external_memory_bytes gauge
nodejs_external_memory_bytes 1728962 1579444523567

# HELP nodejs_heap_space_size_total_bytes Process heap space size total from node.js in bytes.
# TYPE nodejs_heap_space_size_total_bytes gauge
nodejs_heap_space_size_total_bytes{space="read_only"} 262144 1579444523567
nodejs_heap_space_size_total_bytes{space="new"} 1048576 1579444523567
nodejs_heap_space_size_total_bytes{space="old"} 9809920 1579444523567
nodejs_heap_space_size_total_bytes{space="code"} 425984 1579444523567
nodejs_heap_space_size_total_bytes{space="map"} 1052672 1579444523567
nodejs_heap_space_size_total_bytes{space="large_object"} 1077248 1579444523567
nodejs_heap_space_size_total_bytes{space="code_large_object"} 49152 1579444523567
nodejs_heap_space_size_total_bytes{space="new_large_object"} 0 1579444523567

# HELP nodejs_heap_space_size_used_bytes Process heap space size used from node.js in bytes.
# TYPE nodejs_heap_space_size_used_bytes gauge
nodejs_heap_space_size_used_bytes{space="read_only"} 32296 1579444523567
nodejs_heap_space_size_used_bytes{space="new"} 601696 1579444523567
nodejs_heap_space_size_used_bytes{space="old"} 9376600 1579444523567
nodejs_heap_space_size_used_bytes{space="code"} 286688 1579444523567
nodejs_heap_space_size_used_bytes{space="map"} 704320 1579444523567
nodejs_heap_space_size_used_bytes{space="large_object"} 1064872 1579444523567
nodejs_heap_space_size_used_bytes{space="code_large_object"} 3552 1579444523567
nodejs_heap_space_size_used_bytes{space="new_large_object"} 0 1579444523567

# HELP nodejs_heap_space_size_available_bytes Process heap space size available from node.js in bytes.
# TYPE nodejs_heap_space_size_available_bytes gauge
nodejs_heap_space_size_available_bytes{space="read_only"} 229576 1579444523567
nodejs_heap_space_size_available_bytes{space="new"} 445792 1579444523567
nodejs_heap_space_size_available_bytes{space="old"} 417712 1579444523567
nodejs_heap_space_size_available_bytes{space="code"} 20576 1579444523567
nodejs_heap_space_size_available_bytes{space="map"} 343632 1579444523567
nodejs_heap_space_size_available_bytes{space="large_object"} 0 1579444523567
nodejs_heap_space_size_available_bytes{space="code_large_object"} 0 1579444523567
nodejs_heap_space_size_available_bytes{space="new_large_object"} 1047488 1579444523567

# HELP nodejs_version_info Node.js version info.
# TYPE nodejs_version_info gauge
nodejs_version_info{version="v14.16.1",major="14",minor="16",patch="1"} 1

# HELP grafana_image_renderer_service_http_request_duration_seconds duration histogram of http responses labeled with: status_code
# TYPE grafana_image_renderer_service_http_request_duration_seconds histogram
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="1",status_code="200"} 0
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="5",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="7",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="9",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="11",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="13",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="15",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="20",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="30",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_bucket{le="+Inf",status_code="200"} 4
grafana_image_renderer_service_http_request_duration_seconds_sum{status_code="200"} 10.492873834
grafana_image_renderer_service_http_request_duration_seconds_count{status_code="200"} 4

# HELP up 1 = up, 0 = not up
# TYPE up gauge
up 1

# HELP grafana_image_renderer_browser_info A metric with a constant '1 value labeled by version of the browser in use
# TYPE grafana_image_renderer_browser_info gauge
grafana_image_renderer_browser_info{version="HeadlessChrome/79.0.3945.0"} 1
```
