package snowflake

import (
	"fmt"

	snowflakeimpl "github.com/bwmarrin/snowflake"
)

type Snowflake struct {
	node *snowflakeimpl.Node
}

func NewSnowflake(nodeID int64) (*Snowflake, error) {
	node, err := snowflakeimpl.NewNode(nodeID)
	if err != nil {
		return nil, fmt.Errorf("instantiating snowflake node: %w", err)
	}
	return &Snowflake{node: node}, nil
}

// Impl of contracts.Snowflake
func (s *Snowflake) Int64() int64 {
	return s.node.Generate().Int64()
}
