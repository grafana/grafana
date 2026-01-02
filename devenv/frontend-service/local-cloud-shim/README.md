# Local Cloud Shim

This is a local development shim, that forwards MT-Front-end requests to MT-tilt back-end setup.

This is still very much work in progress, so things will change a lot.

```
                                                               ┌──────────────────┐
                                                               │                  │
                                                     ┌─────────▶   MT Front-end   │
                                                     │         │                  │
┌──────────────────┐        ┌──────────────────┐     │         └──────────────────┘
│                  │        │                  │     │
│   User request   │────────▶      Nginx       ├─────┼─┐       ┌──────────────────────┐
│                  │        │                  │     │ │       │                      │
└──────────────────┘        └──────────────────┘     │ └───────▶  Downstream MT-tilt  │
                                                     │         │                      │
                                                     │         └──────────────────────┘
                                                     │
                                                     │         ┌──────────────────────┐
                                                     │         │                      │
                                                     └─────────▶   Mocked responses   │
                                                               │                      │
                                                               └──────────────────────┘
```

## Proxying

Currently, the proxying is done by an Nginx handling the requests in the following way:

1. Most requests are forwarded to the MT-Front-end
2. All the requests that match this pattern `apis|logout|swagger|openapi/v3|login` are forwarded to the MT-tilt back-end
3. Some requests that are breaking the front-end are mocked. For now `/bootdata` and `/api/user/orgs` are mocked. The mock data are stored under the `./mock-data` folder.

## Dev setup

The Tiltfile and the docker compose file, are simplified to avoid spinning up all services, as most are not needed for the shim setup to work.

The rest of the downstream services are handled by `mt-tilt` setup in Enterprise repo.
