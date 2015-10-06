// Copyright (c) 2012, Sean Treadway, SoundCloud Ltd.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Source code and contact info at http://github.com/streadway/amqp

package amqp

import (
	"fmt"
)

// Authentication interface provides a means for different SASL authentication
// mechanisms to be used during connection tuning.
type Authentication interface {
	Mechanism() string
	Response() string
}

// PlainAuth is a similar to Basic Auth in HTTP.
type PlainAuth struct {
	Username string
	Password string
}

func (me *PlainAuth) Mechanism() string {
	return "PLAIN"
}

func (me *PlainAuth) Response() string {
	return fmt.Sprintf("\000%s\000%s", me.Username, me.Password)
}

// Finds the first mechanism preferred by the client that the server supports.
func pickSASLMechanism(client []Authentication, serverMechanisms []string) (auth Authentication, ok bool) {
	for _, auth = range client {
		for _, mech := range serverMechanisms {
			if auth.Mechanism() == mech {
				return auth, true
			}
		}
	}

	return
}
