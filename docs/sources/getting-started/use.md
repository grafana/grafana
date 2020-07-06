USE method - Tom Wilkie developed both 

Utilization - % time the resource is busy, such as node CPU usage
Saturation - Amount of work a resource has to do, often queue length or node load
Errors - Count of error events

Use for hardware resources in infrastructure, such as CPU, memory, network devices

Can make uniform dashboards, scale your observability platform

RED method

https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services (Tom Wilkie talk/blog post)

Rate - Requests per second
Errors - Number of requests that are failing
Duration - Amount of time these requests take, distribution of latency measurements

More applicable to services, especially microservices environment. For each of your services, instrument code to expose them for each component. Consistency in observability. Good for alerting and SLAs. Proxy for user experience.

USE reports on causes of issues. RED reports on user experience, likely to report symptoms of problems.

USE method tells you how happy your machines are, RED method tells you how happy your users are.

Best practice of alerting is to alert on symptoms rather than causes, so alerting should be done on RED dashboards.

The Four Golden Signals

- Link to Google SRE handbook, especially chapter 6: https://landing.google.com/sre/sre-book/toc

Latency - Time taken to serve a request
Traffic - How much demand is placed on your system
Errors - Rate of requests that are failing
Saturation - How "full" your system is

Similar to RED method, plus saturation.