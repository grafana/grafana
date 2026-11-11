package snowflake

import (
	"math/rand"

	"github.com/bwmarrin/snowflake"
)

type Snowflake struct {
	node *snowflake.Node
}

func New() *Snowflake {
	// NewNode never returns an error when the input is in the [0, 1023] range
	node, _ := snowflake.NewNode(rand.Int63n(1024))
	return &Snowflake{node: node}
}

func (s *Snowflake) Generate() int64 {
	return s.node.Generate().Int64()
}
