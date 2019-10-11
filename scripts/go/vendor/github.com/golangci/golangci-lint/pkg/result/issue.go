package result

import (
	"go/token"
)

type Range struct {
	From, To int
}

type Replacement struct {
	NeedOnlyDelete bool     // need to delete all lines of the issue without replacement with new lines
	NewLines       []string // is NeedDelete is false it's the replacement lines
	Inline         *InlineFix
}

type InlineFix struct {
	StartCol  int // zero-based
	Length    int // length of chunk to be replaced
	NewString string
}

type Issue struct {
	FromLinter string
	Text       string
	Pos        token.Position

	LineRange *Range `json:",omitempty"`

	// HunkPos is used only when golangci-lint is run over a diff
	HunkPos int `json:",omitempty"`

	// Source lines of a code with the issue to show
	SourceLines []string

	// If we know how to fix the issue we can provide replacement lines
	Replacement *Replacement
}

func (i *Issue) FilePath() string {
	return i.Pos.Filename
}

func (i *Issue) Line() int {
	return i.Pos.Line
}

func (i *Issue) Column() int {
	return i.Pos.Column
}

func (i *Issue) GetLineRange() Range {
	if i.LineRange == nil {
		return Range{
			From: i.Line(),
			To:   i.Line(),
		}
	}

	if i.LineRange.From == 0 {
		return Range{
			From: i.Line(),
			To:   i.Line(),
		}
	}

	return *i.LineRange
}
