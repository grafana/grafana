# Grafana technical terminology

<!-- Keep terms in alphabetical order: -->

This document defines technical terms used in Grafana.

## TLS/SSL

The acronyms [TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security) (Transport Layer Security and
[SSL](https://en.wikipedia.org/wiki/SSL) (Secure Socket Layer) are both used to describe the HTTPS security layer,
and are in practice synonymous. However, TLS is considered the current name for the technology, and SSL is considered
[deprecated](https://tools.ietf.org/html/rfc7568).

As such, while both terms are in use (also in our codebase) and are indeed interchangeable, TLS is the preferred term.
That said however, we have at Grafana Labs decided to use both acronyms in combination when referring to this type of
technology, i.e. _TLS/SSL_. This is in order to not confuse those who may not be aware of them being synonymous,
and SSL still being so prevalent in common discourse.
