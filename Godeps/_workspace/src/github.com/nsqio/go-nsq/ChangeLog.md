## go-nsq Change Log

### 1.0.4 - 2015-04-07

**Upgrading from 1.0.3**: There are no backward incompatible changes.

 * #133 - fix `ErrNotConnected` race during `Producer` connection (thanks @jeddenlea)
 * #132 - fix `RDY` redistribution after backoff with no connections
 * #128 - fix backoff stall when using `RequeueWithoutBackoff`
 * #127 - fix handling of connection closing when resuming after backoff (thanks @jnewmano)
 * #126 - allow `BackoffStrategy` to be set via flag (thanks @twmb)
 * #125 - add pluggable consumer `BackoffStrategy`; add full-jitter strategy (thanks @hden)
 * #124 - add `DialTimeout` and `LocalAddr` config (thanks @yashkin)
 * #119 - add `Producer.Ping()` method (thanks @zulily)
 * #122 - refactor log level string handling
 * #120 - fix `Message` data races on `responded`
 * #114 - fix lookupd jitter having no effect (thanks @judwhite)

### 1.0.3 - 2015-02-07

**Upgrading from 1.0.2**: There are no backward incompatible changes.

 * #104 - fix reconnect address bug (thanks @ryanslade)
 * #106 - fix backoff reconnect deadlock (thanks @ryanslade)
 * #107 - fix out-of-bounds error when removing nsqlookupd addresses (thanks @andreas)
 * #108 - fix potential logger race conditions (thanks @judwhite)
 * #111 - fix resolved address error in reconnect loop (thanks @twmb)

### 1.0.2 - 2015-01-21

**Upgrading from 1.0.1**: There are no backward incompatible changes.

 * #102 - TLS min/max config defaults (thanks @twmb)
 * #99 - fix `Consumer.Stop()` race and `Producer.Stop()` deadlock (thanks @tylertreat)
 * #92 - expose `Message.NSQDAddress`
 * #95 - cleanup panic during `Consumer.Stop()` if handlers are deadlocked
 * #98 - add `tls-min-version` option (thanks @twmb)
 * #93 - expose a way to get `Consumer` runtime stats (thanks @dcarney)
 * #94 - allow `#ephemeral` topic names (thanks @jamesgroat)

### 1.0.1 - 2014-11-09

**Upgrading from 1.0.0**: There are no backward incompatible changes functionally, however this
release no longer compiles with Go `1.0.x`.

 * #89 - don't spam connection teardown cleanup messages
 * #91 - add consumer `DisconnectFrom*`
 * #87 - allow `heartbeat_interval` and `output_buffer_timeout` to be disabled
 * #86 - pluggable `nsqlookupd` behaviors
 * #83 - send `RDY` before `FIN`/`REQ` (forwards compatibility with nsqio/nsq#404)
 * #82 - fix panic when conn isn't assigned
 * #75/#76 - minor config related bug fixes
 * #75/#77/#78 - add `tls-cert` and `tls-key` config options

### 1.0.0 - 2014-08-11

**Upgrading from 0.3.7**: The public API was significantly refactored and is not backwards
compatible, please read [UPGRADING](UPGRADING.md).

 * #58 - support `IDENTIFY` `msg_timeout`
 * #54 - per-connection TLS config and set `ServerName`
 * #49 - add common connect helpers
 * #43/#63 - more flexible `nsqlookupd` URL specification
 * #35 - `AUTH` support
 * #41/#62 - use package private RNG
 * #36 - support 64 character topic/channel names
 * #30/#38/#39/#42/#45/#46/#48/#51/#52/#65/#70 - refactor public API (see [UPGRADING](UPGRADING.md))

### 0.3.7 - 2014-05-25

**Upgrading from 0.3.6**: There are no backward incompatible changes. **THIS IS THE LAST STABLE
RELEASE PROVIDING THIS API**. Future releases will be based on the api in #30 and **will not be
backwards compatible!**

This is a bug fix release relating to the refactoring done in `0.3.6`.

 * #32 - fix potential panic for race condition when # conns == 0
 * #33/#34 - more granular connection locking

### 0.3.6 - 2014-04-29

**Upgrading from 0.3.5**: There are no backward incompatible changes.

This release includes a significant internal refactoring, designed
to better encapsulate responsibility, see #19.

Specifically:

 * make `Conn` public
 * move transport responsibilities into `Conn` from `Reader`/`Writer`
 * supply callbacks for hooking into `Conn` events

As part of the refactoring, a few additional clean exit related 
issues were resolved:

 * wait group now includes all exit related goroutines
 * ensure that readLoop exits before exiting cleanup
 * always check messagesInFlight at readLoop exit
 * close underlying connection last

### 0.3.5 - 2014-04-05

**Upgrading from 0.3.4**: There are no backward incompatible changes.

This release includes a few new features such as support for channel
sampling and sending along a user agent string (which is now displayed
in `nsqadmin`).

Also, a critical bug fix for potential deadlocks (thanks @kjk
for reporting and help testing).

New Features/Improvements:

 * #27 - reader logs disambiguate topic/channel
 * #22 - channel sampling
 * #23 - user agent

Bug Fixes:

 * #24 - fix racey reader IDENTIFY buffering
 * #29 - fix recursive RLock deadlocks

### 0.3.4 - 2013-11-19

**Upgrading from 0.3.3**: There are no backward incompatible changes.

This is a bug fix release, notably potential deadlocks in `Message.Requeue()` and `Message.Touch()`
as well as a potential busy loop cleaning up closed connections with in-flight messages.

New Features/Improvements:

 * #14 - add `Reader.Configure()`
 * #18 - return an exported error when an `nsqlookupd` address is already configured

Bug Fixes:

 * #15 - dont let `handleError()` loop if already connected
 * #17 - resolve potential deadlocks on `Message` responders
 * #16 - eliminate busy loop when draining `finishedMessages`

### 0.3.3 - 2013-10-21

**Upgrading from 0.3.2**: This release requires NSQ binary version `0.2.23+` for compression
support.

This release contains significant `Reader` refactoring of the RDY handling code paths. The
motivation is documented in #1 however the commits in #8 identify individual changes. Additionally,
we eliminated deadlocks during connection cleanup in `Writer`.

As a result, both user-facing APIs should now be considerably more robust and stable. Additionally,
`Reader` should behave better when backing off.

New Features/Improvements:

 * #9 - ability to ignore publish responses in `Writer`
 * #12 - `Requeue()` method on `Message`
 * #6 - `Touch()` method on `Message`
 * #4 - snappy/deflate feature negotiation

Bug Fixes:

 * #8 - `Reader` RDY handling refactoring (race conditions, deadlocks, consolidation)
 * #13 - fix `Writer` deadlocks
 * #10 - stop accessing simplejson internals
 * #5 - fix `max-in-flight` race condition

### 0.3.2 - 2013-08-26

**Upgrading from 0.3.1**: This release requires NSQ binary version `0.2.22+` for TLS support.

New Features/Improvements:

 * #227 - TLS feature negotiation
 * #164/#202/#255 - add `Writer`
 * #186 - `MaxBackoffDuration` of `0` disables backoff
 * #175 - support for `nsqd` config option `--max-rdy-count`
 * #169 - auto-reconnect to hard-coded `nsqd`

Bug Fixes:

 * #254/#256/#257 - new connection RDY starvation
 * #250 - `nsqlookupd` polling improvements
 * #243 - limit `IsStarved()` to connections w/ in-flight messages
 * #169 - use last RDY count for `IsStarved()`; redistribute RDY state
 * #204 - fix early termination blocking
 * #177 - support `broadcast_address`
 * #161 - connection pool goroutine safety

### 0.3.1 - 2013-02-07

**Upgrading from 0.3.0**: This release requires NSQ binary version `0.2.17+` for `TOUCH` support.

 * #119 - add TOUCH command
 * #133 - improved handling of errors/magic
 * #127 - send IDENTIFY (missed in #90)
 * #16 - add backoff to Reader

### 0.3.0 - 2013-01-07

**Upgrading from 0.2.4**: There are no backward incompatible changes to applications
written against the public `nsq.Reader` API.

However, there *are* a few backward incompatible changes to the API for applications that 
directly use other public methods, or properties of a few NSQ data types:

`nsq.Message` IDs are now a type `nsq.MessageID` (a `[16]byte` array).  The signatures of
`nsq.Finish()` and `nsq.Requeue()` reflect this change.

`nsq.SendCommand()` and `nsq.Frame()` were removed in favor of `nsq.SendFramedResponse()`.

`nsq.Subscribe()` no longer accepts `shortId` and `longId`.  If upgrading your consumers
before upgrading your `nsqd` binaries to `0.2.16-rc.1` they will not be able to send the 
optional custom identifiers.
    
 * #90 performance optimizations
 * #81 reader performance improvements / MPUB support

### 0.2.4 - 2012-10-15

 * #69 added IsStarved() to reader API

### 0.2.3 - 2012-10-11

 * #64 timeouts on reader queries to lookupd
 * #54 fix crash issue with reader cleaning up from unexpectedly closed nsqd connections

### 0.2.2 - 2012-10-09

 * Initial public release
