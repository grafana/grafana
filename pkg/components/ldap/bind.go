// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package ldap

import (
	"errors"

	"github.com/gogits/gogs/modules/asn1-ber"
)

func (l *Conn) Bind(username, password string) error {
	messageID := l.nextMessageID()

	packet := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "LDAP Request")
	packet.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, messageID, "MessageID"))
	bindRequest := ber.Encode(ber.ClassApplication, ber.TypeConstructed, ApplicationBindRequest, nil, "Bind Request")
	bindRequest.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, 3, "Version"))
	bindRequest.AppendChild(ber.NewString(ber.ClassUniversal, ber.TypePrimitive, ber.TagOctetString, username, "User Name"))
	bindRequest.AppendChild(ber.NewString(ber.ClassContext, ber.TypePrimitive, 0, password, "Password"))
	packet.AppendChild(bindRequest)

	if l.Debug {
		ber.PrintPacket(packet)
	}

	channel, err := l.sendMessage(packet)
	if err != nil {
		return err
	}
	if channel == nil {
		return NewError(ErrorNetwork, errors.New("ldap: could not send message"))
	}
	defer l.finishMessage(messageID)

	packet = <-channel
	if packet == nil {
		return NewError(ErrorNetwork, errors.New("ldap: could not retrieve response"))
	}

	if l.Debug {
		if err := addLDAPDescriptions(packet); err != nil {
			return err
		}
		ber.PrintPacket(packet)
	}

	resultCode, resultDescription := getLDAPResultCode(packet)
	if resultCode != 0 {
		return NewError(resultCode, errors.New(resultDescription))
	}

	return nil
}
