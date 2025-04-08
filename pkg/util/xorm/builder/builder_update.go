// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"fmt"
)

// UpdateCond defines an interface that cond could be used with update
type UpdateCond interface {
	IsValid() bool
	OpWriteTo(op string, w Writer) error
}

// Update creates an update Builder
func Update(updates ...Cond) *Builder {
	builder := &Builder{cond: NewCond()}
	return builder.Update(updates...)
}

func (b *Builder) updateWriteTo(w Writer) error {
	if len(b.from) <= 0 {
		return ErrNoTableName
	}
	if len(b.updates) <= 0 {
		return ErrNoColumnToUpdate
	}

	if _, err := fmt.Fprintf(w, "UPDATE %s SET ", b.from); err != nil {
		return err
	}

	for i, s := range b.updates {

		if err := s.OpWriteTo(",", w); err != nil {
			return err
		}

		if i != len(b.updates)-1 {
			if _, err := fmt.Fprint(w, ","); err != nil {
				return err
			}
		}
	}

	if _, err := fmt.Fprint(w, " WHERE "); err != nil {
		return err
	}

	return b.cond.WriteTo(w)
}
