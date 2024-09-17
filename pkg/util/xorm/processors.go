// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

// BeforeInsertProcessor executed before an object is initially persisted to the database
type BeforeInsertProcessor interface {
	BeforeInsert()
}

// BeforeUpdateProcessor executed before an object is updated
type BeforeUpdateProcessor interface {
	BeforeUpdate()
}

// BeforeDeleteProcessor executed before an object is deleted
type BeforeDeleteProcessor interface {
	BeforeDelete()
}

// BeforeSetProcessor executed before data set to the struct fields
type BeforeSetProcessor interface {
	BeforeSet(string, Cell)
}

// AfterSetProcessor executed after data set to the struct fields
type AfterSetProcessor interface {
	AfterSet(string, Cell)
}

// AfterInsertProcessor executed after an object is persisted to the database
type AfterInsertProcessor interface {
	AfterInsert()
}

// AfterUpdateProcessor executed after an object has been updated
type AfterUpdateProcessor interface {
	AfterUpdate()
}

// AfterDeleteProcessor executed after an object has been deleted
type AfterDeleteProcessor interface {
	AfterDelete()
}

// AfterLoadProcessor executed after an ojbect has been loaded from database
type AfterLoadProcessor interface {
	AfterLoad()
}

// AfterLoadSessionProcessor executed after an ojbect has been loaded from database with session parameter
type AfterLoadSessionProcessor interface {
	AfterLoad(*Session)
}

type executedProcessorFunc func(*Session, interface{}) error

type executedProcessor struct {
	fun     executedProcessorFunc
	session *Session
	bean    interface{}
}

func (executor *executedProcessor) execute() error {
	return executor.fun(executor.session, executor.bean)
}

func (session *Session) executeProcessors() error {
	processors := session.afterProcessors
	session.afterProcessors = make([]executedProcessor, 0)
	for _, processor := range processors {
		if err := processor.execute(); err != nil {
			return err
		}
	}
	return nil
}
