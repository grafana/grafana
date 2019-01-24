# Grafana load test

Runs load tests and checks using [k6](https://k6.io/).

## Prerequisites

Docker

## Run

Run load test for 15 minutes:

```bash
$ ./run.sh
```

Run load test for custom duration:

```bash
$ ./run.sh -d 10s
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

    duration: 10s, iterations: -
         vus: 2,   max: 2

    done [==========================================================] 10s / 10s

    █ user auth token test

      █ user authenticates thru ui with username and password

        ✓ response status is 200
        ✓ response has cookie 'grafana_session' with 32 characters

      █ batch tsdb requests

        ✓ response status is 200

    checks.....................: 100.00% ✓ 364 ✗ 0
    data_received..............: 4.0 MB  402 kB/s
    data_sent..................: 120 kB  12 kB/s
    group_duration.............: avg=84.95ms  min=31.49ms med=90.28ms  max=120.08ms p(90)=118.15ms p(95)=118.47ms
    http_req_blocked...........: avg=1.63ms   min=2.18µs  med=1.1ms    max=10.94ms  p(90)=3.34ms   p(95)=4.28ms
    http_req_connecting........: avg=1.37ms   min=0s      med=902.58µs max=10.47ms  p(90)=2.95ms   p(95)=3.82ms
    http_req_duration..........: avg=58.61ms  min=3.86ms  med=60.49ms  max=114.21ms p(90)=92.61ms  p(95)=100.17ms
    http_req_receiving.........: avg=36µs     min=9.78µs  med=31.17µs  max=234.69µs p(90)=61.58µs  p(95)=72.95µs
    http_req_sending...........: avg=361.51µs min=19.57µs med=181.38µs max=10.56ms  p(90)=642.88µs p(95)=845.28µs
    http_req_tls_handshaking...: avg=0s       min=0s      med=0s       max=0s       p(90)=0s       p(95)=0s
    http_req_waiting...........: avg=58.22ms  min=3.8ms   med=59.7ms   max=114.09ms p(90)=92.45ms  p(95)=100.02ms
    http_reqs..................: 382     38.199516/s
    iteration_duration.........: avg=975.79ms min=7.98µs  med=1.08s    max=1.11s    p(90)=1.09s    p(95)=1.11s
    iterations.................: 18      1.799977/s
    vus........................: 2       min=2 max=2
    vus_max....................: 2       min=2 max=2
```
