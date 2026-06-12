package contracts

// Snowflake node id must be between 0 and 1024. (exclusive upper bound)
const SnowflakeNodeIDUpperBound = 1024

type Snowflake interface {
	Int64() int64
}
