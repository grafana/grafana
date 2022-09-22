package logtest

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
)

type Fake struct {
	DebugLogs Logs
	InfoLogs  Logs
	WarnLogs  Logs
	ErrorLogs Logs
}

type Logs struct {
	Calls   int
	Message string
	Ctx     []interface{}
}

func (f *Fake) New(ctx ...interface{}) *log.ConcreteLogger {
	return log.NewNopLogger()
}

func (f *Fake) Log(keyvals ...interface{}) error {
	return nil
}

func (f *Fake) Debug(msg string, ctx ...interface{}) {
	f.DebugLogs.Calls++
	f.DebugLogs.Message = msg
	f.DebugLogs.Ctx = ctx
}

func (f *Fake) Info(msg string, ctx ...interface{}) {
	f.InfoLogs.Calls++
	f.InfoLogs.Message = msg
	f.InfoLogs.Ctx = ctx
}

func (f *Fake) Warn(msg string, ctx ...interface{}) {
	f.WarnLogs.Calls++
	f.WarnLogs.Message = msg
	f.WarnLogs.Ctx = ctx
}

func (f *Fake) Error(msg string, ctx ...interface{}) {
	f.ErrorLogs.Calls++
	f.ErrorLogs.Message = msg
	f.ErrorLogs.Ctx = ctx
}

func (f *Fake) DebugCtx(_ context.Context, msg string, args ...interface{}) {
	f.Debug(msg, args...)
}

func (f *Fake) InfoCtx(_ context.Context, msg string, args ...interface{}) {
	f.Info(msg, args...)
}

func (f *Fake) WarnCtx(_ context.Context, msg string, args ...interface{}) {
	f.Warn(msg, args...)
}

func (f *Fake) FromContext(_ context.Context) log.Logger {
	return f.New()
}
