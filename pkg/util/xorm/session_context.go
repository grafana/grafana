// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import "context"

// Context sets the context on this session
func (session *Session) Context(ctx context.Context) *Session {
	session.ctx = ctx
	return session
}

// PingContext test if database is ok
func (session *Session) PingContext(ctx context.Context) error {
	if session.isAutoClose {
		defer session.Close()
	}

	session.engine.logger.Infof("PING DATABASE %v", session.engine.DriverName())
	return session.DB().PingContext(ctx)
}
