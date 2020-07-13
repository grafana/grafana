# Grafana load test

Runs load tests and checks using [k6](https://k6.io/).

## Prerequisites

Docker

To run the auth proxy test you'll need to setup nginx proxy from docker block and
enable auth proxy together with configuring Grafana for auth proxy.

## Run

Run load test for 15 minutes using 2 virtual users and targeting http://localhost:3000.

```bash
$ ./run.sh
```

Run load test for custom duration:

```bash
$ ./run.sh -d 10s
```

Run load test for custom target url:

```bash
$ ./run.sh -u http://grafana.loc
```

Run load test for 10 virtual users:

```bash
$ ./run.sh -v 10
```

Run load test and send the results to the database "myDb" in influxDB running locally on port 8086 (with no authentication):

```bash
$ ./run.sh  -o influxdb=http://localhost:8086/myDb
```

Run auth token slow test (random query latency between 1 and 30 seconds):

```bash
$ ./run.sh -c auth_token_slow_test -s 30
```

Run auth proxy test:

```bash
$ ./run.sh -c auth_proxy_test
```


Example output:

```bash

          /\      |‾‾|  /‾‾/  /‾/
     /\  /  \     |  |_/  /  / /
    /  \/    \    |      |  /  ‾‾\
   /          \   |  |‾\  \ | (_) |
  / __________ \  |__|  \__\ \___/ .io

  execution: local
     output: -
     script: src/auth_token_test.js

    duration: 15m0s, iterations: -
         vus: 2,     max: 2

    done [==========================================================] 15m0s / 15m0s

    █ user auth token test

      █ user authenticates thru ui with username and password

        ✓ response status is 200
        ✓ response has cookie 'grafana_session' with 32 characters

      █ batch tsdb requests

        ✓ response status is 200

    checks.....................: 100.00% ✓ 32844 ✗ 0
    data_received..............: 411 MB  457 kB/s
    data_sent..................: 12 MB   14 kB/s
    group_duration.............: avg=95.64ms  min=16.42ms  med=94.35ms  max=307.52ms p(90)=137.78ms p(95)=146.75ms
    http_req_blocked...........: avg=1.27ms   min=942ns    med=610.08µs max=48.32ms  p(90)=2.92ms   p(95)=4.25ms
    http_req_connecting........: avg=1.06ms   min=0s       med=456.79µs max=47.19ms  p(90)=2.55ms   p(95)=3.78ms
    http_req_duration..........: avg=58.16ms  min=1ms      med=52.59ms  max=293.35ms p(90)=109.53ms p(95)=120.19ms
    http_req_receiving.........: avg=38.98µs  min=6.43µs   med=32.55µs  max=16.2ms   p(90)=64.63µs  p(95)=78.8µs
    http_req_sending...........: avg=328.66µs min=8.09µs   med=110.77µs max=44.13ms  p(90)=552.65µs p(95)=1.09ms
    http_req_tls_handshaking...: avg=0s       min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
    http_req_waiting...........: avg=57.79ms  min=935.02µs med=52.15ms  max=293.06ms p(90)=109.04ms p(95)=119.71ms
    http_reqs..................: 34486   38.317775/s
    iteration_duration.........: avg=1.09s    min=1.81µs   med=1.09s    max=1.3s     p(90)=1.13s    p(95)=1.14s
    iterations.................: 1642    1.824444/s
    vus........................: 2       min=2   max=2
    vus_max....................: 2       min=2   max=2
```
