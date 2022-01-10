## Channel Leader proposal

Let's say we have 2 Grafana nodes in HA setup behind load balancer. Each Grafana node has its own plugin instance running.

We have many clients which want to consume the same stream (channel) in UI.

What we want to achieve with channel leader selection is to maintain only a single stream between Grafana and plugins throughout all Grafana nodes.

We have the following instruments:

* Redis – since it's pretty convenient and already used to scale Centrifuge PUB/SUB and already used in Grafana for cache
* We can communicate between Grafana nodes over Centrifuge Survey. Each node has unique ID.

### The idea for channel leader concept

* On first subscribe we acquire leadership in Redis, the node becomes channel leader.
* This leader node opens a stream with a plugin to consume channel events.
* Next channel subscribe call (from another client) will be transformed to the leader node over Survey request.
* This way the channel leader node will be responsible for all SubscribeStream and RunStream requests to the plugin.

### Failure scenario #1: Channel leader node crashes

The instant effect here:

* Subscribers on this node will be disconnected
* Subscribers on other nodes won't be affected
* Streaming stops

How to solve:

* Acquired leadership contains leadership ID and expiration time 10s
* While the leader is alive it prolongs entry in Redis periodically 3s
* Each subscription on each node checks entry state and if the entry disappeared or leadership ID changed we consider the leader gone – thus we disconnect a client to let it re-initialize streams. 
* Upon reconnect we check whether we have an existing leader or can acquire leadership.

### Failure scenario #2: Channel leader node does not respond on subscribe

This may be persistent Redis failure, single timeout.

How to solve:

Do retries. Return an error to subscription request - we need to support re-issuing queries on frontend side.

In MVP we can also disconnect client.

### Failure scenario #3: Can't refresh leadership

May be persistent Redis error, single timeout.

How to solve:

Leadership expiration duration should be several refresh timeouts.

Note:
  Also leadership expiration should be several survey timeouts.

Request to Redis timeout (200ms) + refresh interval (3 secs) ~ leadership entry expiration (10 secs)

We can count failure count, at some point close stream. We can make retries at this point.

If we refresh – but there is no entry – then we should close stream.
If we refresh - but there is entry with another leadership ID (or node ID?) – then we should close the current stream.

### Failure scenario #4: Can't check leader during subscription lifetime

Redis should be available – we can postpone decision to the next interval tick. Since most of the time things will fine
this may lead to an increased leadership loss detection with a delay which seems fine to start with.

### Failure scenario #5: Existing subscription consumes events from a stream with another leadershipID 

Not possible with Centrifuge positioning feature if we set a stream epoch to be equal to leadershipID.

### Failure scenario #6: Leadership changed in the middle of subscribe survey

Need to re-check that leadership ID is still the same (and prolong it on expiration time atomically).
Otherwise - return an error.

Think about timeouts more!

Is it actually a valid failure scenario? Maybe with all other mechanics things will work automatically?

### Failure scenario #7: Stream is terminated with error

At this moment we re-establishing it immediately. Same user and same data which was used initially.

This means some events can be lost? Should we notify subscribers that it's time to resubscribe from scratch?

Close RunStream and exit from RunStream manager => nothing will refresh leadership.

Call Clean leadership! If it fails leadership will expire anyway. Maybe we should notify subscriptions that leadership gone? 

### Failure scenario #8: Stream is cleanly finished

Possible solutions:

* Unsubscribe all channels? In Centrifuge is it possible to do?
* Send empty message?
* Send special frame field?

### Diagram

https://swimlanes.io/u/c97HXDAGj
