package sqlstore

import (
	"fmt"
	"testing"
	"time"

	m "github.com/grafana/grafana/pkg/models"
)

type scenario struct {
	now        int64
	inState    m.CheckEvalResult
	stateCheck int64
	frequency  int64
	outState   m.CheckEvalResult
}

func (s scenario) String() string {
	return fmt.Sprintf("<scenario> now=%d, inState=%s, stateCheck=%d, freq=%d, outState=%s", s.now, s.inState, s.stateCheck, s.frequency, s.outState)
}

// if exec date is in future, func should be safe and not make changes to state
func TestScrutinizeStateFuture(t *testing.T) {
	scenarios := []scenario{
		{120, m.EvalResultUnknown, 121, 10, m.EvalResultUnknown},
		{120, m.EvalResultUnknown, 130, 10, m.EvalResultUnknown},
		{120, m.EvalResultUnknown, 140, 10, m.EvalResultUnknown},
		{120, m.EvalResultUnknown, 150, 10, m.EvalResultUnknown},
		{120, m.EvalResultCrit, 121, 10, m.EvalResultCrit},
		{120, m.EvalResultCrit, 130, 10, m.EvalResultCrit},
		{120, m.EvalResultCrit, 140, 10, m.EvalResultCrit},
		{120, m.EvalResultCrit, 150, 10, m.EvalResultCrit},
	}
	for _, s := range scenarios {
		if res := scrutinizeState(time.Unix(s.now, 0), s.inState, time.Unix(s.stateCheck, 0), s.frequency); res != s.outState {
			t.Errorf("scenario %s: expected %s - got %s", s, s.outState, res)
		}
	}
}

var realScenarios = []scenario{
	// should run at (or shortly after) 107, 117, 127, 137, etc
	// if last run stays at 117, state should become unknown after 117 + 2*10 = 137
	{117, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{118, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{119, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{120, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{121, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{122, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{123, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{124, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{125, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{126, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{127, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{128, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{129, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{130, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{131, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{132, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{133, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{134, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{135, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{136, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{137, m.EvalResultCrit, 117, 10, m.EvalResultCrit},
	{138, m.EvalResultCrit, 117, 10, m.EvalResultUnknown},
	{139, m.EvalResultCrit, 117, 10, m.EvalResultUnknown},
	{140, m.EvalResultCrit, 117, 10, m.EvalResultUnknown},
	{141, m.EvalResultCrit, 117, 10, m.EvalResultUnknown},
}

// crit/warn should become unknown after 2*freq has passed
func TestScrutinizeStateCritToUnknown(t *testing.T) {
	for _, s := range realScenarios {
		if res := scrutinizeState(time.Unix(s.now, 0), s.inState, time.Unix(s.stateCheck, 0), s.frequency); res != s.outState {
			t.Errorf("scenario %s: expected %s - got %s", s, s.outState, res)
		}
	}
}

// unknown should just stay unknown
func TestScrutinizeStateStayUnknown(t *testing.T) {
	for _, s := range realScenarios {
		if res := scrutinizeState(time.Unix(s.now, 0), m.EvalResultUnknown, time.Unix(s.stateCheck, 0), s.frequency); res != m.EvalResultUnknown {
			t.Errorf("scenario %s: expected %s - got %s", s, s.outState, res)
		}
	}
}
