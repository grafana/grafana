
## Curl showcase

The 'curl' showcase demonstrates three zone features:

  * Callbacks guaranteed to be made asynchronously and to be made exactly once.
  * Errors are handled automatically.
  * It is trivial to wrap a function that uses the callback-first pattern in
    it's own zone, allowing the implementation to be shorter and not having to
    worry about common mistakes.

This directory contains two files that both contain an implementation of the
'curl' function, which simply downloads a web page, and uses a very simple
in-memory cache.

  * _curl-naive.js_ has a naive implementation that looks good at first glance,
    but has subtle bugs which as pointed out in code comments.
  * _curl-zone.js_ has a slightly shorter implementation that leverages a zone
    to avoid problems.
