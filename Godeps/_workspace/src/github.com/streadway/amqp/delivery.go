// Copyright (c) 2012, Sean Treadway, SoundCloud Ltd.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Source code and contact info at http://github.com/streadway/amqp

package amqp

import (
	"errors"
	"time"
)

var errDeliveryNotInitialized = errors.New("delivery not initialized")

// Acknowledger notifies the server of successful or failed consumption of
// delivieries via identifier found in the Delivery.DeliveryTag field.
//
// Applications can provide mock implementations in tests of Delivery handlers.
type Acknowledger interface {
	Ack(tag uint64, multiple bool) error
	Nack(tag uint64, multiple bool, requeue bool) error
	Reject(tag uint64, requeue bool) error
}

// Delivery captures the fields for a previously delivered message resident in
// a queue to be delivered by the server to a consumer from Channel.Consume or
// Channel.Get.
type Delivery struct {
	Acknowledger Acknowledger // the channel from which this delivery arrived

	Headers Table // Application or header exchange table

	// Properties
	ContentType     string    // MIME content type
	ContentEncoding string    // MIME content encoding
	DeliveryMode    uint8     // queue implemention use - non-persistent (1) or persistent (2)
	Priority        uint8     // queue implementation use - 0 to 9
	CorrelationId   string    // application use - correlation identifier
	ReplyTo         string    // application use - address to to reply to (ex: RPC)
	Expiration      string    // implementation use - message expiration spec
	MessageId       string    // application use - message identifier
	Timestamp       time.Time // application use - message timestamp
	Type            string    // application use - message type name
	UserId          string    // application use - creating user - should be authenticated user
	AppId           string    // application use - creating application id

	// Valid only with Channel.Consume
	ConsumerTag string

	// Valid only with Channel.Get
	MessageCount uint32

	DeliveryTag uint64
	Redelivered bool
	Exchange    string // basic.publish exhange
	RoutingKey  string // basic.publish routing key

	Body []byte
}

func newDelivery(channel *Channel, msg messageWithContent) *Delivery {
	props, body := msg.getContent()

	delivery := Delivery{
		Acknowledger: channel,

		Headers:         props.Headers,
		ContentType:     props.ContentType,
		ContentEncoding: props.ContentEncoding,
		DeliveryMode:    props.DeliveryMode,
		Priority:        props.Priority,
		CorrelationId:   props.CorrelationId,
		ReplyTo:         props.ReplyTo,
		Expiration:      props.Expiration,
		MessageId:       props.MessageId,
		Timestamp:       props.Timestamp,
		Type:            props.Type,
		UserId:          props.UserId,
		AppId:           props.AppId,

		Body: body,
	}

	// Properties for the delivery types
	switch m := msg.(type) {
	case *basicDeliver:
		delivery.ConsumerTag = m.ConsumerTag
		delivery.DeliveryTag = m.DeliveryTag
		delivery.Redelivered = m.Redelivered
		delivery.Exchange = m.Exchange
		delivery.RoutingKey = m.RoutingKey

	case *basicGetOk:
		delivery.MessageCount = m.MessageCount
		delivery.DeliveryTag = m.DeliveryTag
		delivery.Redelivered = m.Redelivered
		delivery.Exchange = m.Exchange
		delivery.RoutingKey = m.RoutingKey
	}

	return &delivery
}

/*
Ack delegates an acknowledgement through the Acknowledger interface that the
client or server has finished work on a delivery.

All deliveries in AMQP must be acknowledged.  If you called Channel.Consume
with autoAck true then the server will be automatically ack each message and
this method should not be called.  Otherwise, you must call Delivery.Ack after
you have successfully processed this delivery.

When multiple is true, this delivery and all prior unacknowledged deliveries
on the same channel will be acknowledged.  This is useful for batch processing
of deliveries.

An error will indicate that the acknowledge could not be delivered to the
channel it was sent from.

Either Delivery.Ack, Delivery.Reject or Delivery.Nack must be called for every
delivery that is not automatically acknowledged.
*/
func (me Delivery) Ack(multiple bool) error {
	if me.Acknowledger == nil {
		return errDeliveryNotInitialized
	}
	return me.Acknowledger.Ack(me.DeliveryTag, multiple)
}

/*
Reject delegates a negatively acknowledgement through the Acknowledger interface.

When requeue is true, queue this message to be delivered to a consumer on a
different channel.  When requeue is false or the server is unable to queue this
message, it will be dropped.

If you are batch processing deliveries, and your server supports it, prefer
Delivery.Nack.

Either Delivery.Ack, Delivery.Reject or Delivery.Nack must be called for every
delivery that is not automatically acknowledged.
*/
func (me Delivery) Reject(requeue bool) error {
	if me.Acknowledger == nil {
		return errDeliveryNotInitialized
	}
	return me.Acknowledger.Reject(me.DeliveryTag, requeue)
}

/*
Nack negatively acknowledge the delivery of message(s) identified by the
delivery tag from either the client or server.

When multiple is true, nack messages up to and including delivered messages up
until the delivery tag delivered on the same channel.

When requeue is true, request the server to deliver this message to a different
consumer.  If it is not possible or requeue is false, the message will be
dropped or delivered to a server configured dead-letter queue.

This method must not be used to select or requeue messages the client wishes
not to handle, rather it is to inform the server that the client is incapable
of handling this message at this time.

Either Delivery.Ack, Delivery.Reject or Delivery.Nack must be called for every
delivery that is not automatically acknowledged.
*/
func (me Delivery) Nack(multiple, requeue bool) error {
	if me.Acknowledger == nil {
		return errDeliveryNotInitialized
	}
	return me.Acknowledger.Nack(me.DeliveryTag, multiple, requeue)
}
