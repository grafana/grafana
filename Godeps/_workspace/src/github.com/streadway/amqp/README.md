# AMQP

AMQP 0.9.1 client with RabbitMQ extensions in Go.

# Status

*Beta*

[![Build Status](https://secure.travis-ci.org/streadway/amqp.png)](http://travis-ci.org/streadway/amqp)

API changes unlikely and will be discussed on [Github
issues](https://github.com/streadway/amqp/issues) along with any bugs or
enhancements.

# Goals

Provide an functional interface that closely represents the AMQP 0.9.1 model
targeted to RabbitMQ as a server.  This includes the minimum necessary to
interact the semantics of the protocol.

# Non-goals

Things not intended to be supported.

  * Auto reconnect and re-synchronization of client and server topologies.
    * Reconnection would require understanding the error paths when the
      topology cannot be declared on reconnect.  This would require a new set
      of types and code paths that are best suited at the call-site of this
      package.  AMQP has a dynamic topology that needs all peers to agree. If
      this doesn't happen, the behavior is undefined.  Instead of producing a
      possible interface with undefined behavior, this package is designed to
      be simple for the caller to implement the necessary connection-time
      topology declaration so that reconnection is trivial and encapsulated in
      the caller's application code.
  * AMQP Protocol negotiation for forward or backward compatibility.
    * 0.9.1 is stable and widely deployed.  Versions 0.10 and 1.0 are divergent
      specifications that change the semantics and wire format of the protocol.
      We will accept patches for other protocol support but have no plans for
      implementation ourselves.
  * Anything other than PLAIN and EXTERNAL authentication mechanisms.
    * Keeping the mechanisms interface modular makes it possible to extend
      outside of this package.  If other mechanisms prove to be popular, then
      we would accept patches to include them in this pacakge.

# Usage

See the 'examples' subdirectory for simple producers and consumers executables.
If you have a use-case in mind which isn't well-represented by the examples,
please file an issue.

# Documentation

Use [Godoc documentation](http://godoc.org/github.com/streadway/amqp) for
reference and usage.

[RabbitMQ tutorials in
Go](https://github.com/rabbitmq/rabbitmq-tutorials/tree/master/go) are also
available.

# Contributing

Pull requests are very much welcomed.  Create your pull request on a non-master
branch, make sure a test or example is included that covers your change and
your commits represent coherent changes that include a reason for the change.

To run the integration tests, make sure you have RabbitMQ running on any host,
export the environment variable `AMQP_URL=amqp://host/` and run `go test -tags
integration`.  TravisCI will also run the integration tests.

Thanks to the [community of contributors](https://github.com/streadway/amqp/graphs/contributors).

# License

BSD 2 clause - see LICENSE for more details.


